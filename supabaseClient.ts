import { createClient } from '@supabase/supabase-js'

// Erstatt disse med dine egne nøkler fra Supabase Dashboard -> Project Settings -> API
const supabaseUrl = 'https://zsoqyerqdxhqnqjvzmsu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzb3F5ZXJxZHhocW5xanZ6bXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTM2NjQsImV4cCI6MjA4NDA2OTY2NH0.tJUWiYfBgVgzDwZH567sAWXDQt6cfe93qhj0n-JcmK8'

// Det er ordet "export" her som manglet eller var feil:
export const supabase = createClient(supabaseUrl, supabaseAnonKey)