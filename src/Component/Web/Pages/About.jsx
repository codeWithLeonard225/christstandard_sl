import React from "react";

import SchoolOwnerImage from '/images/pri.jpg';
import ClassroomImage from '/images/About.jpg';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import Header from "../Navbar/Header";

const team = [
    {
        name: "Ms. Mariatu Kamara",
        role: "Preschool Teacher",
        image: "/images/pri.jpg",
    },
    {
        name: "Mr. Sulaiman Conteh",
        role: "Grade 1 Teacher",
        image: "/images/pri.jpg",
    },
    {
        name: "Nurse Hawa Sesay",
        role: "Day-care Nurse",
        image: "/images/pri.jpg",
    },
    // Add more team members here
    {
        name: "Mr. Abu Bakarr",
        role: "Grade 3 Teacher",
        image: "/images/pri.jpg", // Add more image paths as needed
    },
    {
        name: "Madam Fatu Koroma",
        role: "Administrator",
        image: "/images/pri.jpg", // Add more image paths as needed
    },
    {
        name: "Mr. Ibrahim Sillah",
        role: "Sports Coach",
        image: "/images/pri.jpg", // Add more image paths as needed
    },
];

const ownerName = "[Owner's Name]";
const ownerBio = "With a deep passion for nurturing young minds and a commitment to academic excellence in Sierra Leone, [Owner's Name] established North Carolina Academy to provide a unique and empowering learning environment. [Add a more detailed personal story here, highlighting their connection to Sierra Leone and their vision for education].";
const ownerQuote = "Our aim at North Carolina Academy is to cultivate not just academic success, but also compassionate and responsible future leaders for Sierra Leone.";

// Animation variant for scaling in
const scaleIn = {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { duration: 0.5 },
    viewport: { once: false },
};

// Professional motion variants for Owner's Section
// ✅ Updated motion variants
const ownerImageMotion = {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.7, ease: [0.6, 0.05, -0.01, 0.9] },
    viewport: { once: true, amount: 0.3 }, // ✅ Changed: animate only once
};

const ownerTextMotion = {
    initial: { opacity: 0, y: 50 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: [0.6, 0.05, -0.01, 0.9], delay: 0.3 },
    viewport: { once: true, amount: 0.3 }, // ✅ Changed
};

const ownerQuoteMotion = {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.6, ease: [0.6, 0.05, -0.01, 0.9], delay: 0.5 },
    viewport: { once: true, amount: 0.5 }, // ✅ Changed
};


const MVVItem = ({ title, children, animation }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: false, amount: 0.2 });

    return (
        <motion.div
            ref={ref}
            className="bg-white shadow-md rounded-xl p-8 border border-gray-200 hover:shadow-lg transition duration-300"
            variants={animation}
            initial="initial"
            animate={isInView ? "animate" : "initial"}
        >
            <h3 className="text-2xl font-semibold text-indigo-600 mb-4">{title}</h3>
            {children}
        </motion.div>
    );
};

const About = () => {
    const ownerRef = useRef(null);
    const ownerIsInView = useInView(ownerRef, { once: false, amount: 0.3 });

    return (
        <>

            <Header />
            {/* Hero Section */}
            <section className="relative h-[60vh] md:h-[75vh] bg-cover bg-center flex items-center justify-center text-white " style={{ backgroundImage: `url(${ClassroomImage})` }}>
                <div className="bg-black bg-opacity-50 absolute inset-0"></div>
                <div className="z-10 text-center px-6 ">
                    <motion.h1
                        className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-wide mb-4 animate-fade-in-down"
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        About Christ Standard Secondary School
                    </motion.h1>
                    <motion.p
                        className="text-lg md:text-xl lg:text-2xl font-light animate-fade-in-up delay-200"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                    >
                        Nurturing Young Minds, Building Bright Futures in Sierra Leone
                    </motion.p>
                </div>
            </section>
            {/* Owner's Section */}
            <section className="py-16 px-6 max-w-6xl mx-auto">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="rounded-lg overflow-hidden">
                        <img
                            src={SchoolOwnerImage}
                            alt={ownerName}
                            className="w-full h-auto object-contain"
                            style={{ maxHeight: '500px' }}
                        />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-blue-700 mb-6">
                            {ownerName}'s Vision
                        </h2>
                        <p className="text-lg text-gray-700 leading-relaxed mb-4">
                            With a deep passion for nurturing young minds and a commitment to academic excellence in Sierra Leone, {ownerName} established Christ Standard Secondary School to provide a unique and empowering learning environment.
                        </p>
                        <blockquote className="p-4 border-l-4 border-green-500 bg-green-50 rounded-md">
                            <p className="text-xl italic text-gray-800">
                                "Our aim at Christ Standard Secondary School is to cultivate not just academic success, but also compassionate and responsible future leaders for Sierra Leone."
                            </p>
                        </blockquote>
                    </div>
                </div>
            </section>

            {/* Principal's Section */}
            <section className="py-16 px-6 max-w-6xl mx-auto">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="rounded-lg overflow-hidden">
                        <img
                            src={SchoolOwnerImage} // Replace with principal image if different
                            alt="Principal"
                            className="w-full h-auto object-contain"
                            style={{ maxHeight: '500px' }}
                        />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-blue-700 mb-6">
                            Principal's Message
                        </h2>
                        <p className="text-lg text-gray-700 leading-relaxed mb-4">
                            Our principal is dedicated to guiding Christ Standard Secondary School with a vision that nurtures students academically, socially, and morally, creating future leaders for Sierra Leone.
                        </p>
                        <blockquote className="p-4 border-l-4 border-green-500 bg-green-50 rounded-md">
                            <p className="text-xl italic text-gray-800">
                                "We aim to inspire, challenge, and support every student to reach their full potential at Christ Standard Secondary School."
                            </p>
                        </blockquote>
                    </div>
                </div>
            </section>



            {/* Mission, Vision, Values */}
            <section className="py-16 px-6 bg-gray-50">
                <div className="max-w-6xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-blue-700 mb-8">Our Core Beliefs</h2>
                    <div className="grid gap-8 md:grid-cols-3">
                        <MVVItem title="Our Mission" animation={scaleIn}>
                            To provide a safe, nurturing, and stimulating environment where children develop academically, socially, and emotionally through a balance of play, structure, and guidance.
                        </MVVItem>
                        <MVVItem title="Our Vision" animation={scaleIn}>
                            To be a leading school in Sierra Leone, fostering lifelong learners with strong moral values and leadership skills.
                        </MVVItem>
                        <MVVItem title="Core Values" animation={scaleIn}>
                            <span className="font-semibold text-blue-500">Integrity</span> •
                            <span className="font-semibold text-green-500">Respect</span> •
                            <span className="font-semibold text-yellow-500">Excellence</span> •
                            <span className="font-semibold text-red-500">Responsibility</span> •
                            <span className="font-semibold text-pink-500">Compassion</span>
                        </MVVItem>
                    </div>
                </div>
            </section>

            {/* Team Section (Swiper) */}
            <section className="py-16 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-blue-700 mb-12">Meet Our Dedicated Team</h2>
                    <Swiper
                        modules={[Navigation, Pagination, Autoplay]}
                        spaceBetween={30}
                        slidesPerView={1}
                        breakpoints={{
                            640: {
                                slidesPerView: 2,
                                spaceBetween: 20,
                            },
                            768: {
                                slidesPerView: 3,
                                spaceBetween: 30,
                            },
                            1024: {
                                slidesPerView: 4,
                                spaceBetween: 30,
                            },
                        }}
                        loop={true}
                        autoplay={{
                            delay: 3000,
                            disableOnInteraction: false,
                        }}
                        pagination={{ clickable: true }}
                        navigation={true}
                        className="team-swiper"
                    >
                        {team.map((member, index) => (
                            <SwiperSlide key={index}>
                                <div className="bg-white shadow-md rounded-lg overflow-hidden hover:shadow-xl transition duration-300">
                                    <img src={member.image} alt={member.name} className="w-full h-64 object-cover" style={{ objectPosition: 'top' }} />
                                    <div className="p-6 text-center">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-2">{member.name}</h3>
                                        <p className="text-gray-600 text-sm">{member.role}</p>
                                    </div>
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            </section>
        </>
    );
};

export default About;