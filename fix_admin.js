const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, 'data', 'users.json');
if (!fs.existsSync(usersPath)) {
    console.log('users.json not found');
    process.exit(1);
}

let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
const email = 'info.elumugam@gmail.com';
const newPassword = 'ADMINELUMUGAM';

const userIdx = users.findIndex(u => u.email === email);
if (userIdx !== -1) {
    users[userIdx].isAdmin = true;
    users[userIdx].password = bcrypt.hashSync(newPassword, 10);
    users[userIdx].plan = 'Enterprise';
    console.log(`Updated existing user: ${email}`);
} else {
    users.push({
        id: 'user_admin',
        name: 'Admin',
        email: email,
        password: bcrypt.hashSync(newPassword, 10),
        plan: 'Enterprise',
        avatar: 'AD',
        theme: 'dark',
        isAdmin: true,
        isBlocked: false,
        createdAt: new Date().toISOString()
    });
    console.log(`Created new admin user: ${email}`);
}

fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
console.log('Done!');
