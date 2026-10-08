# Day 8 Reflection

The most difficult concept in the course for me was designing for concurrency and correctness under extreme load. Understanding how race conditions can lead to double-bookings, and then learning how database transactions, row-level locks, and carefully ordered status checks prevent them, took several attempts. I overcame it by sketching the seat-hold and payment flows on paper, walking through what happens when two users click “Buy” at the same millisecond, and repeatedly asking “what if this fails halfway?” until the sequence felt solid.

Looking at my earlier capstone work (the QuickNotes app), the main improvement I would make based on feedback is stronger separation of concerns and clearer error handling. I would extract the localStorage logic into its own module, add more explicit validation feedback, and write a few automated tests for the critical paths so that future changes do not silently break persistence or the count display.

Next I plan to deepen my knowledge of distributed systems and real-world scaling patterns—specifically how companies implement waiting rooms, rate limiting, and cache invalidation for flash-sale scenarios. I also want to practise writing clearer architecture decision records so that the trade-offs I make are easy for others (and my future self) to understand.
