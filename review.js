
// This file contains intentional errors for testing the pre-commit hook

// 1. Security Violations
const accessKey = "AKIA1234567890ABCDEF"; // AWS Key
const secret = "super_secret_password";
eval("console.log('dangerous')");
const md5Hash = require('crypto').createHash('md5');

// 2. Best Practices
var oldVar = "should be let or const";
if (oldVar == "something") { // loose equality
    console.log("loose equality");
}
const fs = require('fs');
const data = fs.readFileSync('test.txt'); // blocking I/O

// 3. Code Quality
console.log("Cleanup me");
debugger;
// TODO: Fix this later
function test() {
    process.exit(1);
}

if (1 == 1) console.log(1);