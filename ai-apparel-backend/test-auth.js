async function runTest() {
  console.log("⏳ 1. Attempting to Register a new user...");
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      name: 'Test User', 
      email: 'test@example.com', 
      password: 'password123' 
    })
  });
  const regData = await regRes.json();
  console.log("Registration Response:", regData);

  console.log("\n⏳ 2. Attempting to Log in...");
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email: 'prasuntellakula29@gmail.com', 
      password: 'password123' 
    })
  });
  const loginData = await loginRes.json();
  console.log("Login Response:", loginData);
}

runTest();