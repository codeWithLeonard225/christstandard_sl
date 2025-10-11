import React from 'react';
import { motion } from 'framer-motion';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-gray-300 py-6 md:py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          <motion.p
            className="text-sm text-center md:text-left"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            &copy; {new Date().getFullYear()} Christ Standard Secondary School. All Rights Reserved.
          </motion.p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
             <a
              href="/privacy-policy"
              className="hover:text-white transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <span className="hidden sm:inline text-gray-500">|</span>
            <a
              href="/terms-of-use"
              className="hover:text-white transition-colors duration-200"
            >
              Terms of Use
            </a>
             <span className="hidden sm:inline text-gray-500">|</span>
            <a
              href="https://yourwebsite.com"  //Replace with actual link
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors duration-200"
            >
              Designed by Leonard
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
