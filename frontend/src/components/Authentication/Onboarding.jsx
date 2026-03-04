import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion'; 
// (If you are still using <motion.div>, ignore this warning or ensure you are using the 'motion' tag)

const Onboarding = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Privacy First",
      icon: "🛡️",
      content: "Co-Lab IDE is built on a local-first architecture. Your code stays on your machine. Synchronization is peer-to-peer and cloud-signaled only when you choose to connect[cite: 13, 142]."
    },
    {
      title: "File Permissions",
      icon: "📂",
      content: "We need internal access to your file system to manage 'Ghost Files'. This allows zero-latency navigation even in massive repositories by mapping metadata skeleton structures[cite: 50, 75]."
    },
    {
      title: "User Agreement",
      icon: "📝",
      content: "By proceeding, you agree to our internal data handling policy. Every change is tracked locally until committed, ensuring your development environment remains private and performant[cite: 143, 146]."
    }
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-obsidian text-white p-6">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="w-full max-w-md bg-slate p-8 rounded-3xl border border-gray-800 shadow-2xl"
        >
          <div className="text-5xl mb-6 flex justify-center">{steps[step].icon}</div>
          <h2 className="text-2xl font-bold text-center mb-4">{steps[step].title}</h2>
          <p className="text-gray-400 text-center text-sm leading-relaxed mb-8">
            {steps[step].content}
          </p>

          <button 
            onClick={nextStep}
            className="w-full py-4 bg-cobalt hover:bg-blue-500 text-white rounded-xl font-bold transition-all transform active:scale-95"
          >
            {step === steps.length - 1 ? "Accept & Get Started" : "Continue"}
          </button>

          <div className="flex justify-center space-x-2 mt-6">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-cobalt' : 'w-2 bg-gray-700'}`}></div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;