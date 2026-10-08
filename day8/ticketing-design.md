# TicketHub – Event Ticketing System Design

## 1. Requirements

### Functional Requirements
- Users can register, log in, and manage their profiles.
- Users can browse upcoming concerts and events, filter by date, location, genre, or artist.
- Users can view detailed event pages showing available seats/sections, prices, and seat maps.
- Users can select and temporarily hold seats while completing payment.
- Users can complete payment and receive confirmed tickets.
- Users can view their purchased tickets and order history.
- Admins can create and manage events, set pricing, and release seat inventory.
- The system must prevent two people from purchasing the same seat.

### Non-Functional Requirements
- **Speed / Latency**: Page loads and seat-map views under 200 ms at the 95th percentile under normal load. Seat-hold and checkout operations complete in under 500 ms.
- **Correctness**: Zero double-bookings. Seat inventory must remain consistent at all times.
- **Fairness**: When demand exceeds supply (popular concert on-sale), the system must not favour any particular user beyond arrival order and successful payment. No preferential treatment or “bots first” behaviour.
- **Availability**: 99.9 % uptime. Survive traffic spikes without data loss.
- **Scalability**: Handle 200 000 concurrent users attempting to buy 20 000 seats in the first 10 minutes of a major on-sale.
- **Security**: Secure authentication, PCI-compliant payment handling, protection against race conditions and inventory overselling.

## 2. Traffic Estimates

### Normal Day
- Registered users: 2 000 000
- Daily unique visitors: 50 000
- Pages viewed per visitor: 10 → **500 000 page views / day**
- Tickets sold: 5 000 / day
- Rough peak (assuming 20 % of traffic in a 2-hour window): ≈ 50 page views / second

### Popular Concert On-Sale (First 10 Minutes)
- People trying to buy: 200 000
- Available seats: 20 000
- Time window: 10 minutes = 600 seconds
- Average arrival rate: **≈ 333 requests / second** just for the purchase path
- Peak can be several times higher in the first 1–2 minutes (flash-crowd effect)
- Seat-map and availability checks will be even higher because many users refresh or open multiple tabs

**Comparison**  
Normal peak ≈ 50 req/s vs. on-sale peak of several hundred to low-thousands of requests per second on the critical seat-hold and checkout paths. This is roughly a **20–50× traffic spike** concentrated on a tiny subset of the inventory (one event’s seats). The design must therefore treat the on-sale scenario as the primary scaling and correctness challenge.

## 3. API Design

All endpoints are versioned under `/api/v1`. Authentication via JWT (Bearer token) except for public browsing endpoints.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events` | List / search events (supports filters: date, city, genre, artist). Paginated. |
| GET | `/events/{eventId}` | Event details + high-level availability summary. |
| GET | `/events/{eventId}/seats` | Seat map / available seats for an event (section, row, seat, price, status). |
| POST | `/events/{eventId}/holds` | Attempt to place a temporary hold on one or more seats. Returns holdId + expiry. |
| POST | `/orders` | Create order from an active hold, process payment, confirm tickets. |
| GET | `/users/me/tickets` | List the authenticated user’s tickets / past orders. |

Additional supporting endpoints (not counted toward the minimum five):  
`POST /auth/login`, `POST /auth/register`, `DELETE /holds/{holdId}` (release), admin CRUD for events.

## 4. Data Model

Four core tables (PostgreSQL):

```
users
-----
id              UUID PRIMARY KEY
email           VARCHAR UNIQUE NOT NULL
password_hash   VARCHAR NOT NULL
name            VARCHAR
created_at      TIMESTAMPTZ

events
------
id              UUID PRIMARY KEY
title           VARCHAR NOT NULL
artist          VARCHAR
venue           VARCHAR
city            VARCHAR
starts_at       TIMESTAMPTZ
status          VARCHAR  -- draft, published, on_sale, sold_out, cancelled
created_at      TIMESTAMPTZ

seats
-----
id              UUID PRIMARY KEY
event_id        UUID REFERENCES events(id)
section         VARCHAR
row_label       VARCHAR
seat_number     VARCHAR
price_cents     INTEGER
status          VARCHAR  -- available, held, sold
hold_id         UUID NULL  -- set while held
hold_expires_at TIMESTAMPTZ NULL
UNIQUE (event_id, section, row_label, seat_number)

orders
------
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
event_id        UUID REFERENCES events(id)
status          VARCHAR  -- pending, paid, cancelled, refunded
total_cents     INTEGER
created_at      TIMESTAMPTZ
paid_at         TIMESTAMPTZ NULL
```

**Relationships**
- One user → many orders
- One event → many seats
- One event → many orders
- One order → many seats (via a junction table `order_items` or by setting `order_id` on seats after payment)
- A seat can be linked to at most one active hold and, after payment, to one order

## 5. Preventing Double-Booking

Double-booking is prevented by a combination of **database constraints**, **short-lived holds**, and **transactions**.

1. **Unique constraint** on `(event_id, section, row_label, seat_number)` guarantees a physical seat exists only once.
2. When a user requests a hold:
   - Begin a transaction with `SELECT … FOR UPDATE` on the chosen seat rows.
   - Check that every seat still has `status = 'available'`.
   - If yes, set `status = 'held'`, write `hold_id` and `hold_expires_at` (e.g. 8–10 minutes), commit.
   - If any seat is already held or sold, the whole hold fails and the user is told the seats are gone.
3. The payment / order creation endpoint:
   - Verifies the hold is still valid (`hold_expires_at > now()` and belongs to the user).
   - Inside a single transaction: mark seats `sold`, create the order record, clear the hold fields, and record payment success.
4. A background job periodically releases expired holds (`status = 'held' AND hold_expires_at < now()` → back to `available`).
5. Optimistic concurrency or version columns can be added for extra safety, but the combination of row-level locks + status checks already provides strong correctness guarantees.

This design ensures that even under extreme concurrency only one transaction can successfully claim a given seat.

## 6. Architecture

```
                    ┌──────────────┐
                    │   CDN /      │
                    │ Static Assets│
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Load Balancer│
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼─────┐   ┌──────▼─────┐   ┌──────▼─────┐
   │ Web / API  │   │ Web / API  │   │ Web / API  │
   │  Servers   │   │  Servers   │   │  Servers   │
   └──────┬─────┘   └──────┬─────┘   └──────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼───────┐
                    │ Redis Cache  │  ← seat availability, holds, rate limits
                    │ + Pub/Sub    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ PostgreSQL   │  ← source of truth (users, events, seats, orders)
                    │ (primary +   │
                    │  replicas)   │
                    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │ Payment      │
                    │ Gateway      │
                    │ (Stripe etc.)│
                    └──────────────┘
```

**How it survives the big sale**
- Stateless API servers behind a load balancer can be auto-scaled horizontally.
- Redis caches the current seat-map and availability counts so the database is not hit on every page refresh.
- Seat-hold and checkout paths always go through the database with proper locking; the cache is invalidated or updated via pub/sub after each successful hold/sale.
- Rate limiting (per IP / per user) and a virtual waiting room (queue) can be placed in front of the critical endpoints to smooth the flash crowd.
- Read replicas handle browsing traffic; writes (holds + orders) go only to the primary.
- Database connection pooling and prepared statements keep the primary from being overwhelmed.

## 7. Trade-offs

**Trade-off 1: Short hold duration vs. user experience**  
A short hold (8–10 min) reduces the window in which seats are locked and unavailable to others, improving fairness and throughput during an on-sale. The downside is that slower users or those who pause to compare seats may lose their selection and have to start over. We chose a relatively short hold because correctness and fairness under extreme contention are more important than perfect convenience for a minority of users.

**Trade-off 2: Strong consistency (row locks + transactions) vs. maximum throughput**  
Using `SELECT … FOR UPDATE` and single-seat transactions guarantees no double-booking, but it serialises concurrent attempts on the same seats and can create hot spots. A fully eventually-consistent or sharded approach could accept higher throughput at the cost of occasional oversells that must later be compensated. For a ticketing system the business cost of a double-booking is extremely high (angry customers, refunds, legal risk), so we deliberately favour strong consistency and accept that some users will see “seat no longer available” under peak load.
