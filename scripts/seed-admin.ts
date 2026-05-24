/**
 * Seed Admin Script
 * Run: npx tsx scripts/seed-admin.ts
 * 
 * Creates the first admin user for the system
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seedAdmin() {
  console.log('Starting admin seed...');

  // Default admin credentials
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Super Admin';

  // Check if admin already exists
  const { data: existingAdmin } = await supabase
    .from('users')
    .select('id')
    .eq('username', adminUsername)
    .single();

  if (existingAdmin) {
    console.log('Admin user already exists:', adminUsername);
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Create admin user
  const { data: admin, error } = await supabase
    .from('users')
    .insert({
      username: adminUsername,
      password_hash: passwordHash,
      name: adminName,
      role: 'super_admin',
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create admin:', error);
    process.exit(1);
  }

  console.log('Admin user created successfully!');
  console.log('Username:', adminUsername);
  console.log('Password:', adminPassword);
  console.log('');
  console.log('IMPORTANT: Change this password immediately after first login!');
}

seedAdmin()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
