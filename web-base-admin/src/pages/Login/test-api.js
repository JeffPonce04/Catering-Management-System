// Run this in browser console to test API connection
const testApiConnection = async () => {
  console.log('Testing API Connection...');
  
  // Test 1: Check if server is reachable
  try {
    const response = await fetch('http://127.0.0.1:8000/api/test');
    console.log('Server reachable:', response.ok);
  } catch (error) {
    console.error('Server not reachable:', error.message);
  }
  
  // Test 2: Test OTP endpoint
  try {
    const response = await fetch('http://127.0.0.1:8000/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber: '09123456789' })
    });
    const data = await response.json();
    console.log('OTP endpoint:', data);
  } catch (error) {
    console.error('OTP endpoint error:', error.message);
  }
};

testApiConnection();