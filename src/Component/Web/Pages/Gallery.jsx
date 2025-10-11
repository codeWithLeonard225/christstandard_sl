import React, { useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";

import Footer from "./Footer"
import Header from '../Navbar/Header';

const categories = [
  { label: 'All', value: 'all' },
  { label: '📷 Pupils in Class', value: 'class' },
  { label: '🏃 Playground Fun', value: 'playground' },
  { label: '👶 Baby Day-Care', value: 'daycare' },
  { label: '🧑‍🏫 Teachers in Action', value: 'teachers' },
  { label: '💻 Computer Sessions', value: 'computer' },
  { label: '📚 Library Moments', value: 'library' }
];

const galleryItems = [
  { src: '/classrooom.jpg', category: 'class' },
  { src: '/photo2.jpg', category: 'playground' },
  { src: '/photo3.jpg', category: 'daycare' },
  { src: '/senior.jpg', category: 'teachers' },
  { src: '/dayCare.jpg', category: 'computer' },
  { src: '/library.jpg', category: 'library' },
];

const Gallery = () => {
  const [filter, setFilter] = useState('all');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const filteredImages = filter === 'all'
    ? galleryItems
    : galleryItems.filter(img => img.category === filter);

  const openModal = (imgSrc) => {
    setSelectedImage(imgSrc);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setSelectedImage(null);
  };

  const modalVariants = {
    initial: { opacity: 0 },
    open: { opacity: 1 },
    closed: { opacity: 0 }
  };

  const imageVariants = {
    initial: { scale: 0.8, opacity: 0 },
    open: { scale: 1, opacity: 1 },
    closed: { scale: 0.8, opacity: 0 }
  };

  return (
    <>
  <Header/>
    <div className="min-h-screen bg-gray-100 p-6 mt-8">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6  pt-10  md:pt-20 lg:pt-14">📷 Bright Future Gallery</h1>

      {/* Filter Buttons */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filter === cat.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <section id="gallery" className="py-16 bg-white text-center px-4">
        <motion.h2
          className="text-2xl sm:text-3xl font-bold mb-4"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          See the Joy in Action
        </motion.h2>

        <motion.p
          className="text-gray-600 mb-8 max-w-2xl mx-auto text-base sm:text-lg"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Browse our gallery of everyday moments and school events.
        </motion.p>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ staggerChildren: 0.3 }}
        >
          {filteredImages.map((img, i) => (
            <motion.img
              key={i}
              src={img.src}
              alt={`Gallery ${i + 1}`}
              className="w-full h-48 sm:h-52 md:h-56 object-cover rounded-lg shadow-md cursor-pointer"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openModal(img.src)}
              loading="lazy"
            />
          ))}
        </motion.div>

        <motion.a
          href="/gallery"
          className="inline-block mt-10 bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition text-sm sm:text-base"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          View Full Gallery
        </motion.a>

        <AnimatePresence>
          {isOpen && selectedImage && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center"
              initial="initial"
              animate="open"
              exit="closed"
              variants={modalVariants}
              onClick={closeModal}
            >
              <motion.img
                src={selectedImage}
                alt="Enlarged view"
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                variants={imageVariants}
                initial="initial"
                animate="open"
                exit="closed"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
    <Footer/>
    </>
  );
};

export default Gallery;
