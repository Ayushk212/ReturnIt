# ReturnIt Architecture & Design Specification

## 1. Domain Design & Core Decisions

ReturnIt is a community-driven Lost & Found platform engineered for privacy, transactional integrity, and low-latency discovery.

- **Privacy-by-Default Identity**: User email and phone are never exposed in public feeds or profile endpoints. Phone and email remain encrypted/private until an item owner explicitly approves a claim. Only the owner and the claimant gain mutual contact visibility upon approval.
- **Account Deletion & Anonymization**: When a user deletes their account (`DELETE /users/me`), PII is redacted: name becomes `"Anonymous User"`, email is randomized to `deleted-<id>@returnit.local`, phone and bio are cleared, and active tokens are revoked. Item listings remain visible with status preserved to maintain community history without dangling references.
- **Verification Gate for Found Items**: Owners posting found items can configure a `verificationQuestion` and hashed expected answer (`verificationAnswerHash`). Non-owners see only the question prompt; the answer hash is never returned by any API endpoint.
- **Transactional Claims**: Approving a claim transitions the item to `resolved`, records an immutable audit trail entry, auto-rejects competing pending claims, and exposes contact info between the two parties in a single atomic MongoDB transaction (`session.withTransaction`). Active claims are bounded by a partial unique index.
- **Token Rotation & Reuse Detection**: Refresh tokens are stored as cryptographic hashes grouped by `familyId`. If an already-rotated refresh token is replayed, the entire family is revoked immediately to prevent session hijacking.

## 2. Expected Query Plans & Index Strategy

All primary data access paths are backed by targeted B-tree, 2dsphere, and text indexes:

| Query Type | Query Shape | Target Index | Expected Engine Stage |
| :--- | :--- | :--- | :--- |
| **Feed Discovery** | `{ type, status, category, dateOccurred: { $lte } }` | `{ type: 1, status: 1, category: 1, dateOccurred: -1 }` | `IXSCAN` |
| **Full-Text Search** | `{ $text: { $search: q }, type, status }` | Weighted Text Index (`title: 10, tags: 5, description: 3, location.label: 2`) | `TEXT` / `IXSCAN` |
| **Proximity Search** | `{ 'location.geo': { $nearSphere: { $geometry: Point, $maxDistance } } }` | `2dsphere` on `'location.geo'` | `GEO_NEAR` / `IXSCAN` |
| **Owner Listings** | `{ owner: userId, createdAt: { $lte } }` | `{ owner: 1, createdAt: -1 }` | `IXSCAN` |
| **Active Claim Dedupe** | `{ item: itemId, claimant: userId, status: 'pending' }` | Partial unique index on `{ item: 1, claimant: 1 }` | `IXSCAN` (O(1) duplicate rejection) |
| **Token Expiry Cleanup**| `{ expiresAt: { $lte: now } }` | `{ expiresAt: 1 }` (TTL: 0 seconds) | Background TTL Thread (`IXSCAN`) |

Every feed query uses cursor-based pagination on `_id` and `dateOccurred` to prevent skip-offset memory degradation and provide stable pagination across insertions.
