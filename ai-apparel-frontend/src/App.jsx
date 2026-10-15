import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Studio from './pages/Studio';

function App() {
  return (
    <BrowserRouter>
      {/* Super simple temporary navigation bar */}
      <nav className="p-4 bg-gray-900 text-white flex gap-4 shadow-md">
        <Link to="/" className="hover:text-blue-400 font-bold">Storefront</Link>
        <Link to="/studio" className="hover:text-blue-400 font-bold">Create Design</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/studio" element={<Studio />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;