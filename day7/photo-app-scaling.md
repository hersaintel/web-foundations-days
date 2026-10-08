# SnapShare: Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from the people they follow. This plan estimates how much traffic and storage the app needs to handle, then designs an architecture that can cope with it.

## 1. Assumptions

These are the starting facts given for the assignment, plus the ones I added:

- 10 million registered users.
- 10% of registered users are active on a given day.
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day.
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail.
- *My assumption:* traffic is spread over a full day (86,400 seconds), and the busiest moments are 5 times the average.
- *My assumption:* I use decimal units (1 MB = 1,000,000 bytes, 1 TB = 1,000,000 MB) to keep the sums simple.

**Daily active users (DAU)** = 10,000,000 × 10% = **1,000,000 users per day**

## 2. Estimates

### Uploads per second

- Uploads per day = 1,000,000 users × 1 photo = 1,000,000 photos
- Average = 1,000,000 ÷ 86,400 = **about 11.6 uploads per second**
- Peak (5×) = 11.57 × 5 = **about 58 uploads per second**
- Peak upload traffic = 58 × 2 MB = about 116 MB per second

### Feed views per second

- Feed views per day = 1,000,000 users × 50 pages = 50,000,000 views
- Average = 50,000,000 ÷ 86,400 = **about 579 feed views per second**
- Peak (5×) = 578.7 × 5 = **about 2,894 feed views per second**

### Storage per year

- Original photos per day = 1,000,000 × 2 MB = 2,000,000 MB = 2 TB
- Original photos per year = 2 TB × 365 = **730 TB**
- Thumbnails per day = 1,000,000 × 50 KB = 50 GB
- Thumbnails per year = 50 GB × 365 = 18,250 GB = **18.25 TB**
- Total per year = 730 + 18.25 = **about 748 TB** (a little under 0.75 PB)
- Storage keeps growing every year, so it must be able to grow without limit and without moving data.

## 3. Read-heavy or write-heavy?

**SnapShare is read-heavy.**

- Every active user views 50 feed pages for every 1 photo they upload, so reads outnumber writes by about **50 to 1** (579 feed views per second against 11.6 uploads per second).
- It is even more lopsided in practice, because each feed page loads many images, and the same popular photo is viewed by all of its owner's followers.
- **What this means for the design:**
  - Make reads fast and cheap first: a **CDN** for images and a **cache** for feed data.
  - Add a **read replica** so feed queries do not compete with writes on the main database.
  - Keep the write path simple and reliable. About 58 uploads per second at peak is small enough for a single primary database.
  - Accept that feeds can be a few seconds out of date in exchange for speed.

## 4. Why photos should not be stored in the database

- **Size:** Photos add about 730 TB per year. A database is built for small, structured rows, and storing huge files in it makes the tables, backups and replicas enormous.
- **Speed:** Sending big files through the database uses up connections and memory that the feed queries need.
- **Cost:** Database storage is much more expensive per gigabyte than object storage.
- **Delivery:** A CDN can serve a file straight from object storage by its URL, but it cannot serve a file stored inside a database.
- **Where they go instead:** Photo files (originals and thumbnails) go in **object storage**, which is cheap, durable, grows without limit and is made for big files. The database stores only a small row for each photo: the owner, the caption, the date, the status and the **storage key** (the file's location in object storage).

## 5. Architecture diagram

```
                  Users (phones and web browsers)
          +----------------------+--------------+
          | photos, thumbnails                  | API calls (feed, upload)
          v                                     v
  +---------------+                    +-----------------+
  |      CDN      |                    |  Load balancer  |
  +---------------+                    +-----------------+
     |                                          |
     |                                          v
     |                             +-------------------------+
     |                             |       App servers       |
     | cache miss                  |    (many, stateless)    |
     |                             +-------------------------+
     |                                          |
     |                                          |
     |        +--------------+------------------+------------------+
     |        |              |                  |                  |
     v        v              v                  v                  v
  +---------------+  +---------------+  +---------------+  +---------------+
  | Object storage|  |     Cache     |  |    Database   |  |     Queue     |
  | (photo files) |  |  (e.g. Redis) |  |   (primary)   |  | (upload jobs) |
  +---------------+  +---------------+  +---------------+  +---------------+
          ^                                     | replication      | job
          |                                     v                  v
          |                             +---------------+  +---------------+
          |                             |  Read replica |  |     Worker    |
          |                             |  (feed reads) |  |  (thumbnails) |
          |                             +---------------+  +---------------+
          |                                                        |
          |   reads original, saves thumbnail                      |
          +--------------------------------------------------------+
```

- The arrows show the direction a request or file travels.
- The app servers save new photos to **object storage** and rows to the **database primary**. They read feeds from the **cache** first, then from the **read replica**.
- The **CDN** serves photos and thumbnails from its own copies. Only on a miss does it fetch the file from object storage.

## 6. What each component does

- **CDN:** It solves slow image loading by keeping copies of photos and thumbnails on servers close to users, so most image requests never reach SnapShare's own servers.
- **Load balancer:** It solves the problem of one server being overloaded (or failing) by spreading incoming requests across many app servers and skipping any that are down.
- **App servers:** They run the SnapShare logic (login, upload, feed) and, because they store no data themselves, we can add more of them whenever traffic grows.
- **Cache:** It solves the repeated, slow work of rebuilding the same feed over and over by keeping recent results in fast memory.
- **Database (primary):** It solves the need for one trusted, consistent record of users, follows, photos and likes by handling all the writes.
- **Read replica:** It solves the read overload on the primary by holding a live copy of the data that feed queries can read from instead.
- **Object storage:** It solves the problem of storing hundreds of terabytes of photos cheaply, safely and with room to keep growing.
- **Queue:** It solves the problem of slow background work holding up the user by holding thumbnail jobs until a worker is free, and by keeping jobs safe if something crashes.
- **Worker:** It solves the thumbnail work by taking jobs off the queue and creating the 50 KB thumbnails away from the upload request, and we can run more workers when uploads rise.

## 7. Upload flow, step by step

1. The user picks a photo in the app and taps **Upload**. The request goes through the load balancer to one of the app servers.
2. The app server checks that the user is logged in and that the file is a valid image of an allowed size.
3. The app server saves the original photo in **object storage** under a unique key, such as `photos/{user_id}/{photo_id}.jpg`.
4. The app server writes a row to the **database primary** with the owner, the date, the storage key and the status `processing`.
5. The app server puts a message on the **queue**: "make a thumbnail for photo `{photo_id}`".
6. The app server replies to the user straight away: "Upload received". The user does not wait for the thumbnail.
7. A **worker** takes the message off the queue, downloads the original from object storage and creates a 50 KB thumbnail.
8. The worker saves the thumbnail in object storage, then updates the database row to status `ready` with the thumbnail's key.
9. The worker confirms the job is done so the queue deletes the message. If the worker crashes first, the message returns to the queue and another worker retries it. After several failed attempts it moves to a "failed jobs" list for someone to investigate.
10. The old cached feed pages of the uploader's followers expire or are cleared, so the new photo appears in their feeds. Its image is then delivered through the CDN.

## 8. Trade-offs

- **Fast reads vs fresh data (cache and read replica).**
  - Pro: Feeds load quickly and the primary database is not overloaded.
  - Con: The cache and the replica can be a few seconds behind, so a new photo may not show up in a follower's feed immediately.
  - Decision: This is acceptable for a social feed, where nobody is harmed by seeing a post a few seconds late. It would not be acceptable for something like a bank balance.
- **Quick uploads vs more moving parts (queue and worker).**
  - Pro: Users get a fast reply and thumbnail work can be scaled separately.
  - Con: The system now has more parts to run and watch (queue, workers, retries, failed jobs), and for a moment after upload the photo has no thumbnail, so the app must show a placeholder.
  - Decision: Worth it because image processing is slow and unpredictable, and the extra complexity is small compared with the benefit.
- **Speed vs cost (CDN and object storage).**
  - Pro: Users around the world load images fast, and storage can grow without limit.
  - Con: We pay for roughly 748 TB of new storage each year plus CDN data transfer, and a longer cache time makes it harder to remove or replace a photo quickly.
  - Decision: Keep thumbnails cached for a long time, since they never change, and move older original photos to cheaper storage over time.
- **Simple uploads vs lighter app servers (a possible improvement).**
  - Right now every photo passes through an app server, which is simple, but at peak that is about 116 MB per second of upload traffic.
  - If this becomes a problem, the app can give the user's phone a temporary upload link so it sends the photo straight to object storage, at the cost of a slightly more complicated flow.
