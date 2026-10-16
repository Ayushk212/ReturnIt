# ReturnIt Security Architecture & Threat Model

This document maps all identified threat vectors to concrete mitigating controls and the specific source files implementing them.

---

## Threat Matrix & Concrete Mitigations

### 1. Account Takeover
- **Threat**: Credential stuffing, brute-force attacks, and session token theft.
- **Mitigation**: Passwords hashed using Argon2id with memory cost 64MB and iteration count 3. Access tokens are short-lived (15 minutes). Refresh tokens are stored as cryptographic hashes and rotated on every use with token-family reuse detection that immediately revokes all family tokens upon replay.
- **Implementing File**: [`apps/api/src/services/auth.service.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/services/auth.service.ts)

### 2. Fake Claims & Griefing
- **Threat**: Malicious actors spamming claims on high-value items or guessing verification answers.
- **Mitigation**: Database-level unique partial index restricts claimants to exactly one active `pending` claim per item. Repeated claim rejections trigger a cooldown window and lower the user's `trustScore`. Claims require detailed proof and are audited immutably.
- **Implementing Files**: [`apps/api/src/models/Claim.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/models/Claim.ts), [`apps/api/src/services/claim.service.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/services/claim.service.ts)

### 3. PII Scraping & Harvest
- **Threat**: Automated bots scraping user phone numbers, emails, or personal locations from listings.
- **Mitigation**: User schemas exclude `phone` from default queries (`select: false`). Public profile projections strictly permit only `name`, `avatarUrl`, `bio`, `trustScore`, and joined date. Coordinates are bounded by a configurable `radiusMeters` fuzzing envelope for high-privacy items.
- **Implementing Files**: [`apps/api/src/models/User.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/models/User.ts), [`apps/api/src/routes/user.routes.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/routes/user.routes.ts)

### 4. Image Abuse (SVG / Stored XSS / EXIF Geolocation Leaks)
- **Threat**: Malicious SVG payloads containing embedded JavaScript or uploaded images leaking victim home coordinates via EXIF GPS metadata.
- **Mitigation**: Upload middleware enforces strict MIME-type allowlists (`image/jpeg`, `image/png`, `image/webp`), rejecting SVGs unconditionally. Cloudinary upload configurations strip all EXIF and GPS metadata on ingress.
- **Implementing Files**: [`apps/api/src/middleware/upload.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/middleware/upload.ts), [`apps/api/src/services/upload.service.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/services/upload.service.ts)

### 5. NoSQL Injection
- **Threat**: Attackers passing MongoDB query selector objects (e.g., `{"$gt": ""}`) in JSON payloads to bypass authentication or filter clauses.
- **Mitigation**: Global `express-mongo-sanitize` middleware strips all keys beginning with `$` or containing `.`. All request bodies, parameters, and query strings are parsed through strict Zod schemas with unknown key stripping.
- **Implementing Files**: [`apps/api/src/middleware/security.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/middleware/security.ts), [`packages/shared/src/schemas.ts`](file:///c:/Users/ayush/Documents/Lost&Found/packages/shared/src/schemas.ts)

### 6. User Enumeration
- **Threat**: Probing registration or login endpoints to determine whether an email exists in the system.
- **Mitigation**: Login endpoints return identical error messages (`"Invalid email or password"`) and execute equal-cost Argon2 dummy hash verification when an email is not found, eliminating timing side-channels.
- **Implementing File**: [`apps/api/src/services/auth.service.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/services/auth.service.ts)

### 7. Insecure Direct Object References (IDOR)
- **Threat**: Modifying or deleting other users' items, claims, or viewing private conversations.
- **Mitigation**: Dedicated authorization checks verify that `req.user.id` matches the resource `owner` or participant array before granting write/read permissions. Moderators have scoped overrides audited with log entries.
- **Implementing Files**: [`apps/api/src/middleware/auth.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/middleware/auth.ts), [`apps/api/src/services/item.service.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/services/item.service.ts)

### 8. Cross-Site Request Forgery (CSRF)
- **Threat**: Forcing authenticated users to perform unintended actions via malicious third-party websites.
- **Mitigation**: Authentication tokens are stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies. The server validates origin headers against an explicit CORS origin allowlist.
- **Implementing Files**: [`apps/api/src/server.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/server.ts), [`apps/api/src/middleware/security.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/middleware/security.ts)

### 9. Rate-Limit & Resource Exhaustion Abuse
- **Threat**: Flooding endpoints to cause denial of service or exhaust SMS/email/database quotas.
- **Mitigation**: IP-based and user-based token bucket rate limiting using `express-rate-limit`. Sensitive endpoints (auth login, claim creation, text search) have tighter request caps. Request bodies are limited to 100KB via `express.json({ limit: '100kb' })`.
- **Implementing File**: [`apps/api/src/middleware/rateLimit.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/middleware/rateLimit.ts)

### 10. Stalking via Premature Contact Exposure
- **Threat**: A predator creating a fake found item to obtain contact details of someone who posted a lost item, or vice-versa.
- **Mitigation**: Item detail endpoints never expose claimant or owner contact information. Mutual contact details are unlocked only after the owner explicitly approves the claim in an atomic transaction.
- **Implementing File**: [`apps/api/src/services/claim.service.ts`](file:///c:/Users/ayush/Documents/Lost&Found/apps/api/src/services/claim.service.ts)
