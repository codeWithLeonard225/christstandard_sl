import React, { useState, useEffect } from "react";

import Footer from "./Footer"
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import Header from "../../Web/Navbar/Header"

const Home = () => {
  const slides = [
    {
      image: "/images/compound.jpg",
      title: "A Foundation for Excellence",
      subtitle: "Quality education focused on holistic development.",
    },
    {
      image: "/images/ug.jpg",
      title: "A Loving Start to Learning",
      subtitle: "Safe, nurturing day-care with qualified staff.",
    },
    {
      image: "/images/senior.jpg",
      title: "Explore Worlds Through Knowledge",
      subtitle: "Fostering curiosity through a vibrant school library.",
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const galleryImages = ["/classrooom.jpg", "/photo2.jpg", "/photo3.jpg", "/senior.jpg"];
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const openModal = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  const modalVariants = {
    initial: { opacity: 0 },
    open: { opacity: 1 },
    closed: { opacity: 0 },
  };

  const imageVariants = {
    initial: { scale: 0.8, opacity: 0 },
    open: { scale: 1, opacity: 1 },
    closed: { scale: 0.8, opacity: 0 },
  };

  return (
    <>
    <Header/>
    
      {/* Hero Section */}
      <section id="home" className="h-screen relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-no-repeat bg-top bg-cover transition-all duration-500 ease-in-out"
          style={{ backgroundImage: `url(${slides[currentSlide].image})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-60 z-10"></div>
        <motion.div
          className="relative z-20 flex flex-col items-center justify-center h-full text-white text-center px-6"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4">{slides[currentSlide].title}</h1>
          <p className="text-lg md:text-2xl mb-6">{slides[currentSlide].subtitle}</p>
          <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 items-center">
            <motion.a
              href="#about"
              className="bg-blue-700 hover:bg-green-600 px-6 py-3 rounded-full shadow-lg font-medium text-center w-full md:w-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Discover Our School
            </motion.a>
            <motion.a
              href="#gallery"
              className="bg-white text-blue-800 hover:bg-gray-200 px-6 py-3 rounded-full font-medium text-center w-full md:w-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              See Our Gallery
            </motion.a>
          </div>
        </motion.div>
      </section>

      {/* A Day in the Life Section */}
      <section id="life" className="py-16 bg-gray-50">
        <div className="text-center mb-12">
          <motion.h2
            className="text-3xl font-bold"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            A Day in the Life at CSSS
          </motion.h2>
          <motion.p
            className="text-gray-600 mt-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Experience joyful learning and care every day.
          </motion.p>
        </div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ staggerChildren: 0.2 }}
        >
          {[
            { image: "/classrooom.jpg", title: "Morning Learning Sessions", text: "Interactive and engaging." },
            { image: "/playground.jpg", title: "Joyful Playtime", text: "Social development through fun." },
            { image: "/teacher_help.jpg", title: "Personalized Attention", text: "Teachers who care deeply." },
            { image: "/library.jpg", title: "Library Moments", text: "Exploring books and ideas." },
            { image: "/dayCare.jpg", title: "Day-Care Comfort", text: "Safe space for young learners." },
            { image: "/computer_lab.jpg", title: "Computer Literacy", text: "Building digital skills early." },
          ].map(({ image, title, text }, i) => (
            <motion.div
              key={i}
              className="bg-white shadow-lg rounded-xl overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <img src={image} alt={title} className="w-full h-52 object-cover" loading="lazy" />
              <div className="p-4">
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-gray-600">{text}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-white">
        <div className="text-center mb-12">
          <motion.h2
            className="text-3xl font-bold"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Why CSSS?
          </motion.h2>
        </div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-5 gap-6 max-w-6xl mx-auto px-4 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ staggerChildren: 0.2 }}
        >
          {[
            { icon: "❤️", title: "Caring Teachers", desc: "Passionate educators supporting every learner." },
            { icon: "🛡️", title: "Safe Environment", desc: "Secure, clean facilities and happy spaces." },
            { icon: "🌱", title: "Holistic Education", desc: "Academics, sports, and creativity balanced." },
            { icon: "👶", title: "Early Years Care", desc: "Day-care with qualified nursing staff." },
            { icon: "💻", title: "Modern Resources", desc: "Well-equipped library and computer lab." },
          ].map(({ icon, title, desc }, i) => (
            <motion.div
              key={i}
              className="p-6 bg-gray-100 rounded-lg shadow-sm"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="text-4xl mb-2">{icon}</div>
              <h3 className="font-bold text-lg">{title}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 bg-gray-50">
        <div className="text-center mb-12">
          <motion.h2
            className="text-3xl font-bold"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            What Parents Say
          </motion.h2>
        </div>
        <motion.div
          className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto px-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ staggerChildren: 0.3 }}
        >
          {[1, 2, 3].map((t) => (
            <motion.div
              key={t}
              className="bg-white shadow-lg p-6 rounded-lg"
              initial={{ opacity: 0, x: t % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <img src={`/parent${t}.jpg`} alt="Parent" className="w-16 h-16 rounded-full mb-4" loading="lazy" />
              <p className="text-gray-700 italic">
                “This school truly changed my child’s life. The teachers are loving, the facilities are clean, and my child is happy.”
              </p>
              <p className="text-sm font-semibold mt-2">– Parent {t}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Gallery Teaser */}
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
          {galleryImages.map((img, i) => (
            <motion.img
              key={i}
              src={img}
              alt={`Gallery ${i + 1}`}
              className="w-full h-48 sm:h-52 md:h-56 object-cover rounded-lg shadow-md cursor-pointer"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openModal(img)}
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
          {selectedImage && (
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
                onClick={(e) => e.stopPropagation()} // prevent closing on image click
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      <Footer/>
    </>
  );
};

export default Home;