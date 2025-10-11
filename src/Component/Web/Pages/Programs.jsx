import React from 'react';
import { Link } from 'react-router-dom';
import { FaBaby, FaBookOpen, FaCode, FaPuzzlePiece, FaUsers, FaArrowRight } from 'react-icons/fa';

import Footer from './Footer';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import Header from '../Navbar/Header';

// Animation variants for fade-in
const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.5 },
};

// Animation variants for slide-in from left
const slideInLeft = {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5 },
};

// Animation variants for slide-in from right
const slideInRight = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5 },
};

// Data for programs
const programs = [
    {
        id: 'creche-nursery',
        title: "Creche & Nursery",
        description: "We provide a loving, safe, and stimulating environment for your little ones, guided by qualified caregivers and nursing teachers. Our focus is on early development through play and nurturing care.",
        image: "/classrooom.jpg", // Replace with a relevant image
        icon: <FaBaby />,
        learnMoreLink: '/programs/creche-nursery',
        animationVariant: slideInLeft,
    },
    {
        id: 'primary-school',
        title: "Primary School",
        description: "A strong academic foundation using modern teaching methods, local and international curriculum integration, and digital tools. We foster a love of learning and build essential skills.",
        image: "/classrooom.jpg", // Replace with a relevant image
        icon: <FaBookOpen />,
        learnMoreLink: '/programs/primary-school',
        animationVariant: slideInRight,
    },
    {
        id: 'ict-digital-literacy',
        title: "ICT & Digital Literacy",
        description: "From basic computer use to digital creativity, our ICT lab is a hub for empowering future innovators. Students develop essential digital skills for the 21st century.",
        image: "/classrooom.jpg", // Replace with a relevant image
        icon: <FaCode />,
        learnMoreLink: '/programs/ict-digital-literacy',
        animationVariant: slideInLeft,
    },
    {
        id: 'extra-curricular-activities',
        title: "Extra-Curricular Activities",
        description: "We believe learning goes beyond the classroom. Activities include arts, music, sports, drama, debate, gardening, and various clubs to foster holistic development.",
        image: "/classrooom.jpg", // Replace with a relevant image
        icon: <FaPuzzlePiece />,
        learnMoreLink: '/programs/extra-curricular-activities',
        animationVariant: slideInRight,
    },
    {
        id: 'support-programs',
        title: "Support Programs",
        description: "Inclusive learning for all: Remedial classes, learning support, and a nurturing environment for students with special educational needs to ensure everyone can thrive.",
        image: "/classrooom.jpg", // Replace with a relevant image
        icon: <FaUsers />,
        learnMoreLink: '/programs/support-programs',
        animationVariant: slideInLeft,
    },
];

function AnimatedProgramCard({ program }) {
    const cardRef = useRef(null);
    const imageRef = useRef(null);
    const textRef = useRef(null);

    const cardIsInView = useInView(cardRef, { once: false, amount: 0.3 });
    const imageIsInView = useInView(imageRef, { once: false, amount: 0.3 });
    const textIsInView = useInView(textRef, { once: false, amount: 0.3 });

    return (
        <motion.div
            ref={cardRef}
            className="flex flex-col sm:flex-row bg-gray-50 rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition duration-300 transform hover:scale-105"
            variants={program.animationVariant}
            initial="initial"
            animate={cardIsInView ? "animate" : "initial"}
        >
            <motion.img
                ref={imageRef}
                src={program.image}
                alt={program.title}
                className="w-full sm:w-1/3 h-48 object-cover"
                variants={fadeIn}
                initial="initial"
                animate={imageIsInView ? "animate" : "initial"}
            />
            <motion.div
                ref={textRef}
                className="p-6 flex flex-col justify-center"
                variants={fadeIn}
                initial="initial"
                animate={textIsInView ? "animate" : "initial"}
            >
                <h2 className="text-2xl font-semibold mb-2 flex items-center">
                    <span className="mr-2 text-blue-600 text-xl">{program.icon}</span>
                    {program.title}
                </h2>
                <p className="text-sm leading-relaxed mb-4">{program.description}</p>
                <Link
                    to={program.learnMoreLink}
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold transition duration-300 hover:underline"
                >
                    Learn More
                    <FaArrowRight className="ml-2" />
                </Link>
            </motion.div>
        </motion.div>
    );
}

export default function ProgramsPage() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: false, amount: 0.3 });

    return (
            <><Header/>
            <div className="bg-white text-gray-800 px-4 sm:px-8 lg:px-20 py-12">
                <h1
                    className="text-3xl sm:text-4xl font-bold text-center mb-12 pt-10 md:pt-10"
                >
                    Our Programs
                </h1>

                <div className="grid gap-12 lg:grid-cols-2" ref={ref}>
                    {programs.map((program) => (
                        <AnimatedProgramCard key={program.id} program={program} />
                    ))}
                </div>

                {/* Call to Action for Registration */}
                <motion.div
                    className="mt-16 text-center"
                    initial="initial"
                    animate={isInView ? "animate" : "initial"}
                    variants={fadeIn}
                    viewport={{ once: false, amount: 0.3 }}
                >
                    <h3 className="text-2xl font-semibold mb-4">Ready to enroll your child?</h3>
                    <p className="mb-6 text-gray-600">Our diverse programs are designed to inspire, educate, and care for the next generation of leaders and innovators in Sierra Leone.</p>
                    <Link
                        to="/register"
                        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition duration-300"
                    >
                        Start Online Registration
                    </Link>
                </motion.div>
            </div>
            <Footer />
        </>
    );
}