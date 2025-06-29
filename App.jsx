import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Import components
import Header from './components/Header';
import Hero from './components/Hero';
import Education from './components/Education';
import PropertyListings from './components/PropertyListings';
import Recommendations from './components/Recommendations';
import Footer from './components/Footer';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Header />
        <Routes>
          <Route path="/" element={
            <>
              <Hero />
              <Education />
              <PropertyListings />
              <Recommendations />
            </>
          } />
          <Route path="/education" element={<Education />} />
          <Route path="/listings" element={<PropertyListings />} />
          <Route path="/recommendations" element={<Recommendations />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;

