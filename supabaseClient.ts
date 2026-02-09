import { createClient } from '@supabase/supabase-js'

// Bytt ut disse med dine verdier fra Supabase Dashboard
const supabaseUrl = 'https://zsoqyerqdxhqnqjvzmsu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzb3F5ZXJxZHhocW5xanZ6bXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTM2NjQsImV4cCI6MjA4NDA2OTY2NH0.tJUWiYfBgVgzDwZH567sAWXDQt6cfe93qhj0n-JcmK8'

export const supabase = createClient(supabaseUrl, supabaseKey)