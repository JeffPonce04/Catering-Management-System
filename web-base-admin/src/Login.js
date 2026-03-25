// import React, { useState } from "react";

// function Login({ onLoginSuccess }) {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');

//   function attemptLogin() {
//     if (email === "admin" && password === "123") {
//       onLoginSuccess();
//     } else {
//       alert("Invalid login");
//     }
//   }

//   return (
//     <div className="login-container">
//       <h2>Login</h2>

//       <input 
//         type="text" 
//         placeholder="Email"
//         onChange={(e) => setEmail(e.target.value)} 
//       />

//       <input 
//         type="password" 
//         placeholder="Password"
//         onChange={(e) => setPassword(e.target.value)} 
//       />

//       <button onClick={attemptLogin}>LOGIN</button>
//     </div>
//   );
// }

// export default Login;
