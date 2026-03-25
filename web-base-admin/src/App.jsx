// import React, { useState } from 'react'
// import Header from './Components/Header'
// import MenuSection from './components/MenuSection'
// import OrderSection from './components/OrderSection'
// import PaymentSection from './components/PaymentSection'

// function App() {
//   const [currentOrder, setCurrentOrder] = useState([])
//   const [transactionNumber] = useState('12344567')

//   const addToOrder = (item) => {
//     setCurrentOrder(prev => {
//       const existingItem = prev.find(orderItem => 
//         orderItem.name === item.name && 
//         orderItem.size === item.size &&
//         JSON.stringify(orderItem.addOns) === JSON.stringify(item.addOns)
//       )
      
//       if (existingItem) {
//         return prev.map(orderItem =>
//           orderItem === existingItem
//             ? { ...orderItem, quantity: orderItem.quantity + 1 }
//             : orderItem
//         )
//       } else {
//         return [...prev, { ...item, quantity: 1 }]
//       }
//     })
//   }

//   const removeFromOrder = (index) => {
//     setCurrentOrder(prev => prev.filter((_, i) => i !== index))
//   }

//   const updateQuantity = (index, newQuantity) => {
//     if (newQuantity <= 0) {
//       removeFromOrder(index)
//     } else {
//       setCurrentOrder(prev => 
//         prev.map((item, i) => 
//           i === index ? { ...item, quantity: newQuantity } : item
//         )
//       )
//     }
//   }

//   const clearOrder = () => {
//     setCurrentOrder([])
//   }

//   return (
//     <div className="pos-container">
//       <MenuSection onAddToOrder={addToOrder} />
//       <OrderSection 
//         order={currentOrder}
//         transactionNumber={transactionNumber}
//         onRemoveItem={removeFromOrder}
//         onUpdateQuantity={updateQuantity}
//         onClearOrder={clearOrder}
//       />
//       <PaymentSection order={currentOrder} />
//     </div>
//   )
// }

// export default App
