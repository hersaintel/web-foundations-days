# Library API Design: Books Resource

A REST API for a library's catalogue of books. Every request and response body is JSON, so requests that send a body use the header `Content-Type: application/json`.

## The Book object

- `id`: number, set by the server
- `title`: string, required
- `author`: string, required
- `isbn`: string, optional
- `publishedYear`: number, optional
- `copiesAvailable`: number, optional (defaults to 1)

Example:

```json
{
  "id": 7,
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "9780385474542",
  "publishedYear": 1958,
  "copiesAvailable": 3
}
```

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns every book in the library as an array.
- **Request body:** none
- **Success status:** `200 OK`

### 2. Get one book

- **Method:** `GET`
- **Path:** `/books/{id}` (for example `/books/7`)
- **Description:** Returns the single book with the given id.
- **Request body:** none
- **Success status:** `200 OK`

### 3. Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book; the server assigns the `id` and returns the created book.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "9780385474542",
    "publishedYear": 1958,
    "copiesAvailable": 3
  }
  ```

- **Success status:** `201 Created`

### 4. Update a book

- **Method:** `PUT`
- **Path:** `/books/{id}` (for example `/books/7`)
- **Description:** Replaces the details of an existing book with the data sent.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "9780385474542",
    "publishedYear": 1958,
    "copiesAvailable": 2
  }
  ```

- **Success status:** `200 OK`

### 5. Delete a book

- **Method:** `DELETE`
- **Path:** `/books/{id}` (for example `/books/7`)
- **Description:** Removes the book from the library.
- **Request body:** none
- **Success status:** `204 No Content` (the response has no body)

### 6. List books by an author

- **Method:** `GET`
- **Path:** `/books?author={name}` (for example `/books?author=Chinua%20Achebe`)
- **Description:** Returns only the books written by the author given in the `author` query parameter.
- **Request body:** none
- **Success status:** `200 OK`
- **Note:** If the author has no books, the API still returns `200 OK` with an empty array `[]`, because the search itself worked.

## Error codes

Errors use the same JSON shape every time:

```json
{ "error": "A short message explaining what went wrong" }
```

### 400 Bad Request

- **Meaning:** The request is invalid, so the server cannot process it.
- **Example 1:** `POST /books` with a body that has no `title`, or with `publishedYear` set to `"abc"` instead of a number.
- **Example 2:** `GET /books/seven`, because the id must be a number.

### 404 Not Found

- **Meaning:** The request was valid, but the book it points to does not exist.
- **Example 1:** `GET /books/9999` when no book has the id 9999.
- **Example 2:** `PUT /books/9999` or `DELETE /books/9999` for a book that was already deleted.
