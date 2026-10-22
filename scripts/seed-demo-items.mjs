import pg from 'pg';
import crypto from 'node:crypto';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_sGoiD3k5WIVR@ep-shy-lab-b5lgvovr-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create or upsert 4 dummy users
    const users = [
      {
        id: '11111111-1111-4111-a111-111111111111',
        name: 'Priya Verma',
        email: 'priya.verma@mnnit.ac.in',
        bio: 'B.Tech CSE \'25 | Raman Hostel | Coding & Robotics Club',
        phone: '9876543210',
        role: 'user',
        status: 'active',
        trustScore: 24,
      },
      {
        id: '22222222-2222-4222-a222-222222222222',
        name: 'Rohit Sharma',
        email: 'rohit.sharma@mnnit.ac.in',
        bio: '1st Year IT | SVBH Hostel | Football Enthusiast',
        phone: '9876543211',
        role: 'user',
        status: 'active',
        trustScore: 16,
      },
      {
        id: '33333333-3333-4333-a333-333333333333',
        name: 'Aditya Kumar',
        email: 'aditya.kumar@mnnit.ac.in',
        bio: '2nd Year ECE | Malviya Hostel | Gymkhana Sports Sec',
        phone: '9876543212',
        role: 'user',
        status: 'active',
        trustScore: 28,
      },
      {
        id: '44444444-4444-4444-a444-444444444444',
        name: 'Ananya Singh',
        email: 'ananya.singh@mnnit.ac.in',
        bio: 'Final Year Mechanical | C.V. Raman Hall | SAE MNNIT',
        phone: '9876543213',
        role: 'user',
        status: 'active',
        trustScore: 35,
      },
    ];

    for (const u of users) {
      // Upsert in neon_auth.user so auth table matches
      await client.query(`
        INSERT INTO neon_auth.user (id, name, email, "emailVerified", role, banned, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, true, 'user', false, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          "updatedAt" = NOW()
      `, [u.id, u.name, u.email]);

      // Upsert in application users table
      await client.query(`
        INSERT INTO users (id, email, name, phone, bio, role, status, trust_score, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          bio = EXCLUDED.bio,
          trust_score = EXCLUDED.trust_score,
          updated_at = NOW()
      `, [u.id, u.email, u.name, u.phone, u.bio, u.role, u.status, u.trustScore]);
    }

    console.log('Dummy users inserted/updated successfully.');

    // 2. Demo items (2 Lost, 2 Found)
    const items = [
      {
        type: 'lost',
        title: 'Matte Navy Blue Hydro Flask Water Bottle',
        description: 'Left my dark blue Hydro Flask with MNNIT robotics club sticker in the Central Library 2nd floor reading hall near desk 42 yesterday evening around 6 PM. Has slight scuffs near the base.',
        category: 'other',
        locationLabel: 'Central Library 2nd Floor, MNNIT',
        ownerId: '11111111-1111-4111-a111-111111111111',
        images: [
          {
            url: '/demo/water_bottle.jpg',
            publicId: 'demo-water-bottle',
            alt: 'Matte Navy Blue Hydro Flask Water Bottle on wooden library desk',
            width: 800,
            height: 600,
          },
        ],
        verificationQuestion: null,
        verificationAnswerHash: null,
        tags: ['bottle', 'hydroflask', 'library', 'blue'],
      },
      {
        type: 'lost',
        title: 'Casio fx-991CW ClassWiz Scientific Calculator',
        description: 'Black casing with slight wear on the solar panel. Misplaced during Mathematics-III lecture in Computer Centre Room CC-3. Very urgent as upcoming mid-term exams require it.',
        category: 'electronics',
        locationLabel: 'Computer Centre (CC-3), Academic Block',
        ownerId: '22222222-2222-4222-a222-222222222222',
        images: [
          {
            url: '/demo/calculator.jpg',
            publicId: 'demo-calculator',
            alt: 'Casio scientific calculator on lecture hall desk',
            width: 800,
            height: 600,
          },
        ],
        verificationQuestion: null,
        verificationAnswerHash: null,
        tags: ['calculator', 'casio', 'cc3', 'maths'],
      },
      {
        type: 'found',
        title: 'Boat Wave Call Smartwatch (Charcoal Black)',
        description: 'Found a black silicone strap Boat smartwatch sitting on the bench outside Gymkhana Ground pavilion after evening cricket practice. Watch was on and locked with a pattern passcode. Kept safely.',
        category: 'electronics',
        locationLabel: 'Gymkhana Ground Pavilion, MNNIT',
        ownerId: '33333333-3333-4333-a333-333333333333',
        images: [
          {
            url: '/demo/smartwatch.jpg',
            publicId: 'demo-smartwatch',
            alt: 'Boat smartwatch on wooden pavilion bench',
            width: 800,
            height: 600,
          },
        ],
        verificationQuestion: 'What initials or lockscreen wallpaper is shown on the watch?',
        verificationAnswerHash: crypto.createHash('sha256').update('cricket').digest('hex'),
        tags: ['smartwatch', 'boat', 'gymkhana', 'sports'],
      },
      {
        type: 'found',
        title: 'MNNIT Allahabad Student Identity Card & Lanyard',
        description: 'Found a blue MNNIT branded neck lanyard with an ID card attached in the Student Activity Centre (SAC) cafeteria near the counter around lunch time. Kept with care for the owner.',
        category: 'documents',
        locationLabel: 'SAC Cafeteria, Student Activity Centre',
        ownerId: '44444444-4444-4444-a444-444444444444',
        images: [
          {
            url: '/demo/id_lanyard.jpg',
            publicId: 'demo-id-lanyard',
            alt: 'Blue student identity card and lanyard on cafeteria table',
            width: 800,
            height: 600,
          },
        ],
        verificationQuestion: 'What registration number / branch is on the ID card?',
        verificationAnswerHash: crypto.createHash('sha256').update('20234012').digest('hex'),
        tags: ['id', 'card', 'lanyard', 'sac', 'cafeteria'],
      },
    ];

    for (const item of items) {
      await client.query(`
        INSERT INTO items (
          type, title, description, category, location_label,
          date_occurred, status, owner_id, verification_question,
          verification_answer_hash, tags, images, expires_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          NOW() - INTERVAL '4 hours', 'open', $6, $7,
          $8, $9, $10, NOW() + INTERVAL '90 days', NOW(), NOW()
        )
      `, [
        item.type,
        item.title,
        item.description,
        item.category,
        item.locationLabel,
        item.ownerId,
        item.verificationQuestion,
        item.verificationAnswerHash,
        item.tags,
        JSON.stringify(item.images),
      ]);
    }

    await client.query('COMMIT');
    console.log('4 custom demo items (2 lost, 2 found) created successfully with realistic images!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
