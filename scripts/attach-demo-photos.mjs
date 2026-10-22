import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_sGoiD3k5WIVR@ep-shy-lab-b5lgvovr-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });

async function processImage(filePath) {
  const input = fs.readFileSync(filePath);
  const image = sharp(input).rotate();
  const meta = await image.metadata();

  const { data, info } = await image
    .clone()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await image
    .clone()
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75, effort: 4 })
    .toBuffer();

  return {
    data,
    thumb,
    width: info.width,
    height: info.height,
    mime: 'image/webp',
    bytes: data.length,
  };
}

async function attachPhotos() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mapping = [
      {
        titleLike: '%Hydro Flask%',
        file: 'frontend/public/demo/water_bottle.jpg',
      },
      {
        titleLike: '%Calculator%',
        file: 'frontend/public/demo/calculator.jpg',
      },
      {
        titleLike: '%Smartwatch%',
        file: 'frontend/public/demo/smartwatch.jpg',
      },
      {
        titleLike: '%Identity Card%',
        file: 'frontend/public/demo/id_lanyard.jpg',
      },
    ];

    for (const entry of mapping) {
      const itemRes = await client.query('SELECT id, title FROM items WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [entry.titleLike]);
      if (itemRes.rows.length === 0) {
        console.warn(`Item not found for pattern: ${entry.titleLike}`);
        continue;
      }

      const item = itemRes.rows[0];
      const photo = await processImage(entry.file);

      // Remove existing photo at position 0
      await client.query('DELETE FROM item_images WHERE item_id = $1 AND position = 0', [item.id]);

      // Insert processed photo
      await client.query(
        `INSERT INTO item_images (item_id, position, mime, width, height, bytes, data, thumb, created_at)
         VALUES ($1, 0, $2, $3, $4, $5, $6, $7, NOW())`,
        [item.id, photo.mime, photo.width, photo.height, photo.bytes, photo.data, photo.thumb],
      );

      console.log(`Attached realistic photo to "${item.title}" (${item.id}) - size: ${photo.width}x${photo.height}, ${photo.bytes} bytes`);
    }

    await client.query('COMMIT');
    console.log('All demo photos successfully attached to items in database!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error attaching photos:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

attachPhotos();
