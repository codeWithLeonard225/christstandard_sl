import React from 'react';
import Header from '../Navbar/Header';
import Footer from './Footer';
import { motion } from 'framer-motion';


const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

const slideInLeft = {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
};

const slideInRight = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
};

const ContactUsPage = () => {
    return (
        <>
            <Header />
            <motion.div
                className="bg-white text-gray-800 px-4 sm:px-8 lg:px-20 py-12 mt-8 "
                variants={fadeIn}
                initial="initial"
                animate="animate"
                exit="exit"
            >
                <motion.h1
                    className="text-3xl sm:text-4xl font-bold text-center mb-10 pt-10 md:pt-14"
                    variants={fadeIn}
                    transition={{ delay: 0.2 }}
                >
                    Contact Us
                </motion.h1>

                {/* Info Section */}
                <motion.div
                    className="grid md:grid-cols-2 gap-12 mb-16"
                    variants={fadeIn}
                    transition={{ delay: 0.4 }}
                >
                    <motion.div variants={slideInLeft}>
                        <h2 className="text-xl font-semibold mb-4">School Address</h2>
                        <p className="text-gray-700 mb-6">
                            Excellence International School<br />
                            123 Education Lane, Freetown, Sierra Leone
                        </p>

                        <h2 className="text-xl font-semibold mb-4">Phone Numbers</h2>
                        <p className="text-gray-700 mb-6">
                            General Inquiries: <a href="tel:+23230123456" className="text-blue-600 hover:underline">+232 30 123 456</a><br />
                            Admissions Office: <a href="tel:+23276123456" className="text-blue-600 hover:underline">+232 76 123 456</a>
                        </p>

                        <h2 className="text-xl font-semibold mb-4">Email Addresses</h2>
                        <p className="text-gray-700 mb-6">
                            General: <a href="mailto:info@excellenceschool.edu.sl" className="text-blue-600 hover:underline">info@nca.edu.sl</a><br />
                            Admissions: <a href="mailto:admissions@excellenceschool.edu.sl" className="text-blue-600 hover:underline">admissions@nca.edu.sl</a>
                        </p>

                        <h2 className="text-xl font-semibold mb-4">Office Hours</h2>
                        <p className="text-gray-700">
                            Monday – Friday: 8:00 AM – 4:00 PM<br />
                            Saturday: 9:00 AM – 1:00 PM<br />
                            Sunday: Closed
                        </p>
                    </motion.div>

                    {/* Contact Form */}
                    <motion.div variants={slideInRight}>
                        <h2 className="text-xl font-semibold mb-4">Send Us a Message</h2>
                        <form className="space-y-4">
                            <div>
                                <label className="block mb-1 font-medium">Full Name</label>
                                <input type="text" placeholder="Your Name" className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block mb-1 font-medium">Email Address</label>
                                <input type="email" placeholder="your@email.com" className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block mb-1 font-medium">Subject</label>
                                <input type="text" placeholder="Subject" className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block mb-1 font-medium">Message</label>
                                <textarea rows="5" placeholder="Your Message" className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required></textarea>
                            </div>
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition duration-300">
                                Send Message
                            </button>
                        </form>
                    </motion.div>
                </motion.div>

                {/* Google Map */}
                <motion.div
                    variants={fadeIn}
                    transition={{ delay: 0.6 }}
                >
                    <h2 className="text-xl font-semibold mb-4 text-center">Our Location</h2>
                    <div className="w-full h-64 rounded-lg overflow-hidden shadow-md">
                        <iframe
                            title="School Location"
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d31844.67101980423!2d-13.2434308!3d8.4844447!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfcf77cb78cf5291%3A0x7c228a1184ec75b0!2sFreetown%2C%20Sierra%20Leone!5e0!3m2!1sen!2ssl!4v1700000000000!5m2!1sen!2ssl"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        ></iframe>
                    </div>
                </motion.div>
            </motion.div>
            <Footer />
        </>
    );
};

export default ContactUsPage;