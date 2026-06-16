import React, { useState } from 'react';
import LandingPage from './pages/LandingPage';
import Step1 from './pages/Step1';
import LoadingPhoto from './pages/LoadingPhoto';
import Step2 from './pages/Step2';
import Step3 from './pages/Step3';
import Step4 from './pages/Step4';
import GeneratingSticker from './pages/GeneratingSticker';
import ResultPage from './pages/ResultPage';
import AdminPanel from './pages/AdminPanel';
import './App.css';

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAdmin, setIsAdmin] = useState(
    window.location.pathname === '/admin' || 
    window.location.pathname === '/admin/' ||
    window.location.hash === '#/admin' ||
    window.location.search.includes('admin=true')
  );

  // Shared form data
  const [formData, setFormData] = useState({
    name: '',
    photo: null,
    day: '',
    month: '',
    year: '',
    email: '',
    club: '',
    weight: '',
    height: ''
  });

  const updateFormData = (data) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  if (isAdmin) {
    return (
      <AdminPanel 
        onClose={() => {
          setIsAdmin(false);
          window.history.pushState({}, '', '/');
        }} 
      />
    );
  }

  return (
    <>
      {currentStep === 0 && <LandingPage onStart={() => setCurrentStep(1)} />}
      {currentStep === 1 && <Step1 onNext={() => setCurrentStep(2)} formData={formData} updateFormData={updateFormData} />}
      {currentStep === 2 && <LoadingPhoto onFinish={() => setCurrentStep(3)} />}
      {currentStep === 3 && <Step2 onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(1)} formData={formData} updateFormData={updateFormData} />}
      {currentStep === 4 && <Step3 onNext={() => setCurrentStep(5)} onBack={() => setCurrentStep(3)} formData={formData} updateFormData={updateFormData} />}
      {currentStep === 5 && <Step4 onNext={() => setCurrentStep(6)} onBack={() => setCurrentStep(4)} formData={formData} />}
      {currentStep === 6 && <GeneratingSticker onFinish={() => setCurrentStep(7)} formData={formData} updateFormData={updateFormData} />}
      {currentStep === 7 && <ResultPage formData={formData} />}
    </>
  );
}

export default App;
