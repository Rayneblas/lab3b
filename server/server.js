// Import required modules
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
// Load secrets from server/.env first, then fall back to the repo-root .env.
// Paths are based on this file's location, so it works no matter which folder you run `node` from.
// dotenv never overwrites a variable that's already set, so server/.env wins if both files exist
// (and real environment variables, like Render/Heroku settings, win over both).
// If a file doesn't exist (e.g. on Render), dotenv just skips it - it doesn't throw.
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Supabase now issues "secret" keys (sb_secret_...) in place of the legacy service_role key.
// Either one works here; the legacy name is kept as a fallback for older projects.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL (Supabase -> Project Settings -> Data API -> Project URL)');
if (!SUPABASE_SECRET_KEY) missing.push('SUPABASE_SECRET_KEY (Supabase -> Project Settings -> API Keys -> Secret key, sb_secret_...)');
if (missing.length) {
    console.error('Missing required environment variable(s):\n  - ' + missing.join('\n  - '));
    console.error('Locally: copy .env.example to server/.env and fill it in. On Render/Heroku: add them in the service\'s Environment settings.');
    process.exit(1);
}

// Initialize Supabase client.
// This one client is shared by every request, so don't let it remember a logged-in user's session
// (otherwise one student's login would change the credentials used for everyone else's requests).
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const app = express();
app.use(express.json());

// Serve static files from React build folder
app.use(express.static(path.join(__dirname, '../client/build')));

// ========================================================
// Authentication Routes using Supabase Auth
// ========================================================

// Registration endpoint using Supabase Auth
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    console.log(`Received registration request for email: ${email}`);

    // Email validation
    const emailPattern = /@(spelman\.edu|morehouse\.edu)$/;
    if (!emailPattern.test(email)) {
        return res.status(400).json({ success: false, message: 'Email must end with @spelman.edu or @morehouse.edu.' });
    }

    try {
        // Register user in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } } // Store additional user info
        });

        if (error) throw error;

        res.json({ success: true, message: 'Registration successful. Check your email for verification.' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: error.message || 'Error registering user' });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`Received login request for email: ${email}`);

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // The name was saved in user_metadata at signup; the frontend shows it on the dashboard
        const name = data.user.user_metadata?.name;
        res.json({ success: true, message: 'Login successful', name, user: data.user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
});

// Email verification using 6-digit code
app.post('/verify', async (req, res) => {
    const { email, verificationCode } = req.body;
    console.log(`Verifying email: ${email} with code: ${verificationCode}`);

    try {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token: verificationCode,
            type: 'signup'
        });

        if (error) {
            console.error('Verification failed:', error);
            return res.status(400).json({ success: false, message: 'Invalid verification code.' });
        }

        res.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Error verifying email' });
    }
});

// ========================================================
// Message Board Routes
// ========================================================

// Get the 20 newest messages
app.get('/messages', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        res.json({ success: true, messages: data });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, message: error.message || 'Error loading messages' });
    }
});

// Post a new message
app.post('/messages', async (req, res) => {
    const { name, text } = req.body;
    console.log(`Received message from: ${name}`);

    // Reject empty messages
    if (!text || !text.trim()) {
        return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }

    try {
        const { error } = await supabase.from('messages').insert({ name, text });
        if (error) throw error;

        res.json({ success: true, message: 'Message posted' });
    } catch (error) {
        console.error('Post message error:', error);
        res.status(500).json({ success: false, message: error.message || 'Error posting message' });
    }
});

// Fallback route to serve React frontend for any unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});