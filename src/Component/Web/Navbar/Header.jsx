import React, { useState } from "react";
import { FaBars, FaTimes } from "react-icons/fa"; // 💡 IMPORTED ICONS FROM REACT-ICONS
import { Link } from 'react-router-dom';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "About Us", path: "/about" },
    { name: "Programs", path: "/programs" },
    { name: "Gallery", path: "/gallery" },
    { name: "Contact", "path": "/contact" },
  ];

  return (
    <header className="fixed w-full top-0 z-50 bg-white shadow-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
       <div className="flex items-center space-x-2">

          <div>
            <img className="w-[50px]" src="/images/CSSSBADGE.jpg" alt="Academy Logo" />
          </div>
          <div>
            {/* Logo */}
            <Link to="/" className="text-xl font-bold text-blue-700">Christ Standard Secondary School</Link>
          </div>

        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.name} to={link.path} className="text-gray-700 hover:text-blue-700 font-medium">
              {link.name}
            </Link>
          ))}
          <Link to="/login" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
           Login
          </Link>
        </nav>

        {/* Mobile Hamburger */}
        <div className="md:hidden">
          <button onClick={toggleMenu} aria-label="Toggle menu" className="text-gray-700 hover:text-blue-700">
            {/* 💡 REPLACED LUCIDE ICONS with FaBars and FaTimes */}
            {mobileMenuOpen 
                ? <FaTimes size={24} /> 
                : <FaBars size={24} />
            }
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg px-4 py-2 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="block text-gray-700 hover:text-blue-700 font-medium py-1"
              onClick={toggleMenu}
            >
              {link.name}
            </Link>
          ))}
          <Link
            to="/login"
            className="block bg-blue-600 text-white text-center mt-2 py-2 rounded-md hover:bg-blue-700 transition"
            onClick={toggleMenu}
          >
           Login
          </Link>
        </div>
      )}
    </header>
  );
};

export default Header;