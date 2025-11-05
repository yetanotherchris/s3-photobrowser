#!/usr/bin/env tsx

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const outputDir = path.resolve(process.cwd(), 'test/fixtures/photos');

// Create directory if it doesn't exist
mkdirSync(outputDir, { recursive: true });

interface PersonData {
  name: string;
  role: string;
  color: string;
}

const people: PersonData[] = [
  { name: 'John Smith', role: 'Software Engineer', color: '#4A90E2' },
  { name: 'Sarah Johnson', role: 'Product Manager', color: '#E94B3C' },
  { name: 'Michael Chen', role: 'UX Designer', color: '#50C878' },
  { name: 'Emily Davis', role: 'Data Scientist', color: '#9B59B6' },
  { name: 'David Wilson', role: 'DevOps Engineer', color: '#F39C12' },
  { name: 'Lisa Anderson', role: 'Marketing Director', color: '#1ABC9C' },
  { name: 'James Martinez', role: 'Senior Developer', color: '#E74C3C' },
  { name: 'Jessica Brown', role: 'QA Engineer', color: '#3498DB' },
  { name: 'Robert Taylor', role: 'Tech Lead', color: '#2ECC71' },
  { name: 'Jennifer Lee', role: 'HR Manager', color: '#9B59B6' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

async function generateCVPhoto(person: PersonData, index: number) {
  const width = 800;
  const height = 1000;

  const color = hexToRgb(person.color);

  // Create an SVG with text and shapes
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- White background -->
      <rect width="${width}" height="${height}" fill="#FFFFFF"/>

      <!-- Colored header -->
      <rect width="${width}" height="250" fill="${person.color}"/>

      <!-- Profile circle -->
      <circle cx="${width / 2}" cy="150" r="70" fill="#FFFFFF"/>

      <!-- Initials -->
      <text x="${width / 2}" y="165" font-family="Arial" font-size="48" font-weight="bold"
            fill="${person.color}" text-anchor="middle">${person.name
    .split(' ')
    .map((n) => n[0])
    .join('')}</text>

      <!-- Name -->
      <text x="${width / 2}" y="320" font-family="Arial" font-size="42" font-weight="bold"
            fill="#2C3E50" text-anchor="middle">${person.name}</text>

      <!-- Role -->
      <text x="${width / 2}" y="370" font-family="Arial" font-size="28"
            fill="#7F8C8D" text-anchor="middle">${person.role}</text>

      <!-- Contact section -->
      <text x="80" y="450" font-family="Arial" font-size="24" font-weight="bold"
            fill="#2C3E50">Contact</text>
      <text x="80" y="490" font-family="Arial" font-size="20"
            fill="#7F8C8D">Email: ${person.name.toLowerCase().replace(' ', '.')}@example.com</text>
      <text x="80" y="525" font-family="Arial" font-size="20"
            fill="#7F8C8D">Phone: +1 (555) 123-4567</text>
      <text x="80" y="560" font-family="Arial" font-size="20"
            fill="#7F8C8D">Location: San Francisco, CA</text>

      <!-- Skills section -->
      <text x="80" y="620" font-family="Arial" font-size="24" font-weight="bold"
            fill="#2C3E50">Skills</text>
      <text x="80" y="660" font-family="Arial" font-size="20" fill="#7F8C8D">• JavaScript</text>
      <text x="80" y="695" font-family="Arial" font-size="20" fill="#7F8C8D">• TypeScript</text>
      <text x="80" y="730" font-family="Arial" font-size="20" fill="#7F8C8D">• React</text>
      <text x="80" y="765" font-family="Arial" font-size="20" fill="#7F8C8D">• Node.js</text>
      <text x="80" y="800" font-family="Arial" font-size="20" fill="#7F8C8D">• AWS</text>
      <text x="80" y="835" font-family="Arial" font-size="20" fill="#7F8C8D">• Docker</text>

      <!-- Decorative line -->
      <rect x="50" y="440" width="5" height="400" fill="${person.color}"/>

      <!-- Date stamp -->
      <text x="${width / 2}" y="${height - 30}" font-family="Arial" font-size="16"
            fill="#BDC3C7" text-anchor="middle">Created: ${new Date(
    Date.now() - index * 7 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split('T')[0]}</text>
    </svg>
  `;

  const filename = `cv_photo_${index + 1}_${person.name.toLowerCase().replace(' ', '_')}.jpg`;
  const filepath = path.join(outputDir, filename);

  // Convert SVG to JPEG using Sharp
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toFile(filepath);

  console.log(`✓ Generated: ${filename}`);
}

async function generateAllPhotos() {
  console.log('Generating test CV photos...');
  for (let i = 0; i < people.length; i++) {
    await generateCVPhoto(people[i], i);
  }
  console.log(`✅ Generated ${people.length} test CV photos in ${outputDir}`);
}

generateAllPhotos();
