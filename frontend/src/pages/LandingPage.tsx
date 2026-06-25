import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { 
  ShieldCheck, 
  Sparkles, 
  MessageSquare, 
  ArrowRight, 
  Zap,
  ChevronRight,
  UserCheck,
  MapPin,
  ShieldAlert
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();



  // State for AI Optimizer interactive widget demo
  const [basicInput, setBasicInput] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);

  // Predefined interactive examples for the widget
  const optimizerExamples = [
    {
      input: 'os book',
      enhanced: 'Operating System Concepts (10th Edition) — Silberschatz',
      category: 'Textbooks',
      score: 98,
      desc: 'Clean copy textbook with no handwritten highlights. Essential for the CSE Operating Systems curriculum. Comes with the original cover.'
    },
    {
      input: 'ti 84',
      enhanced: 'Texas Instruments TI-84 Plus Graphing Calculator',
      category: 'Calculators',
      score: 96,
      desc: 'Highly reliable graphing calculator in excellent working condition. Slide cover is included. Batteries replaced recently.'
    },
    {
      input: 'lab coat',
      enhanced: 'Unisex White Chemistry & Biology Lab Coat (Size M)',
      category: 'Lab Equipment',
      score: 94,
      desc: 'Standard protective lab coat. Fits size Medium. Used for one semester in Chemistry Lab, freshly dry-cleaned with zero chemical stains.'
    },
    {
      input: 'dbms notes',
      enhanced: 'Database Management Systems — Comprehensive Unit 1-5 Lecture Notes',
      category: 'Study Notes',
      score: 92,
      desc: 'Extremely neat handwritten notes covering all core units, SQL syntax guides, schema diagrams, and past year question answers.'
    }
  ];

  const handleInteractiveOptimize = (customText?: string) => {
    const textToOptimize = (customText || basicInput).trim().toLowerCase();
    if (!textToOptimize) return;

    setIsOptimizing(true);
    setOptimizationResult(null);

    setTimeout(() => {
      // Look for a close match in examples, otherwise generate a dynamic mock output
      const matched = optimizerExamples.find(ex => 
        textToOptimize.includes(ex.input) || ex.input.includes(textToOptimize)
      );

      if (matched) {
        setOptimizationResult(matched);
      } else {
        setOptimizationResult({
          input: basicInput,
          enhanced: `${basicInput.charAt(0).toUpperCase() + basicInput.slice(1)} — Campus Premium Edition`,
          category: 'Textbooks & Materials',
          score: 85,
          desc: `Clean and well-maintained ${basicInput} suitable for university courses. Available for immediate pickup on campus.`
        });
      }
      setIsOptimizing(false);
    }, 850);
  };

  const selectExample = (inputVal: string) => {
    setBasicInput(inputVal);
    handleInteractiveOptimize(inputVal);
  };

  return (
    <div className="space-y-20 pb-16 animate-fade-in">
      
      {/* 1. Hero Section */}
      <section className="relative pt-8 md:pt-16 pb-6 flex flex-col items-center text-center space-y-8">
        


        {/* Master Heading */}
        <div className="space-y-4 max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-black font-display tracking-tight leading-[1.1] text-slate-900 dark:text-white">
            The Decoupled Campus Marketplace for <span className="bg-gradient-to-r from-brand-500 to-indigo-600 bg-clip-text text-transparent">Verified Students</span>
          </h1>
          <p className="text-base md:text-xl text-slate-600 dark:text-slate-400 font-normal max-w-2xl mx-auto leading-relaxed">
            Discover a seamless way to buy, sell, and swap campus essentials with verified students and create effortless AI-powered listings.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          <Button 
            variant="primary" 
            size="lg" 
            onClick={() => navigate('/marketplace')}
            className="font-bold w-full sm:w-auto shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 group rounded-xl"
          >
            <span>Explore Marketplace</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          {session ? (
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => navigate('/sell')}
              className="font-bold w-full sm:w-auto bg-white/70 dark:bg-darkbg-card/50 rounded-xl"
            >
              Sell Smarter
            </Button>
          ) : (
            <Button 
              variant="secondary" 
              size="lg" 
              onClick={() => navigate('/login')}
              className="font-bold w-full sm:w-auto rounded-xl"
            >
              Sign In with Google
            </Button>
          )}
        </div>


      </section>

      {/* 2. core Pillars Section */}
      <section className="space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-4xl font-extrabold font-display text-slate-900 dark:text-white">
            Designed for Campus Commerce
          </h2>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-450 max-w-xl mx-auto">
            Explore the premium, student-exclusive features engineered to make buying, selling, and swapping items on campus safe and seamless.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Domain Lock */}
          <Card hoverEffect className="flex flex-col space-y-4 border-slate-200/60 dark:border-darkbg-border/50 bg-white/50">
            <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-950/20 text-brand-500 dark:text-brand-400 flex items-center justify-center border border-brand-200/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-850 dark:text-white">College Domain Lock</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              We strictly enforce authentication using student credentials from <code className="bg-slate-100 dark:bg-darkbg-border px-1.5 py-0.5 rounded font-mono text-xs">@kpriet.ac.in</code>. Rest assured, you trade with peer classmates.
            </p>
          </Card>

          {/* Card 2: AI Optimizer */}
          <Card hoverEffect className="flex flex-col space-y-4 border-slate-200/60 dark:border-darkbg-border/50 bg-white/50">
            <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-950/20 text-brand-500 dark:text-brand-400 flex items-center justify-center border border-brand-200/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-850 dark:text-white">AI Listing Optimizer</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Provide a basic listing title and let Google Gemini generate polished listing names, complete descriptions, classify categories, and verify quality criteria automatically.
            </p>
          </Card>

          {/* Card 3: Real-Time Chat */}
          <Card hoverEffect className="flex flex-col space-y-4 border-slate-200/60 dark:border-darkbg-border/50 bg-white/50">
            <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-950/20 text-brand-500 dark:text-brand-400 flex items-center justify-center border border-brand-200/20">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-850 dark:text-white">Real-Time Chat & Swap</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Negotiate details and coordinates directly in-app. Keep communications verified within SemesterSwap to protect your agreements and maintain safety.
            </p>
          </Card>

          {/* Card 4: Student Trust Profiles */}
          <Card hoverEffect className="flex flex-col space-y-4 border-slate-200/60 dark:border-darkbg-border/50 bg-white/50">
            <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-950/20 text-brand-500 dark:text-brand-400 flex items-center justify-center border border-brand-200/20">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-850 dark:text-white">Student Trust Profiles</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Swap with confidence. Every user features transparent rating tracking, completed transaction counts, active trust scores, and reviews left by other student peers.
            </p>
          </Card>

          {/* Card 5: Secure Coordinates */}
          <Card hoverEffect className="flex flex-col space-y-4 border-slate-200/60 dark:border-darkbg-border/50 bg-white/50">
            <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-950/20 text-brand-500 dark:text-brand-400 flex items-center justify-center border border-brand-200/20">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-850 dark:text-white">Campus Coordinate Meetups</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Select designated safe campus meetup coordinates. Secure pin confirmation codes must be validated on both ends to complete hand-offs and transfer ownership.
            </p>
          </Card>

          {/* Card 6: Safety Guards */}
          <Card hoverEffect className="flex flex-col space-y-4 border-slate-200/60 dark:border-darkbg-border/50 bg-white/50">
            <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-950/20 text-brand-500 dark:text-brand-400 flex items-center justify-center border border-brand-200/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-850 dark:text-white">Safety & Reliability Audits</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Maintain an active, healthy marketplace. Our platform penalizes flakey behavior with no-show tracking, transaction cancellations caps, and block/reporting tools.
            </p>
          </Card>
        </div>
      </section>

      {/* 3. Interactive AI Assistant Widget */}
      <section className="bg-white/40 dark:bg-darkbg-card/20 backdrop-blur-md border border-slate-200/60 dark:border-darkbg-border/50 rounded-3xl p-6 md:p-10 grid lg:grid-cols-12 gap-8 items-center">
        
        {/* Left copy */}
        <div className="lg:col-span-5 space-y-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/20 font-bold text-xs">
            <Zap className="h-3.5 w-3.5" />
            <span>Interactive Tool Preview</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold font-display text-slate-900 dark:text-white leading-tight">
            See the AI Assistant in Action
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            Type a short shorthand phrase for a student item you want to sell, or select one of the common campus examples below to witness the Gemini Listing Assistant enhance it.
          </p>
          
          {/* Quick templates */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Try these templates:</p>
            <div className="flex flex-wrap gap-2">
              {['os book', 'ti 84', 'lab coat', 'dbms notes'].map((ex) => (
                <button
                  key={ex}
                  onClick={() => selectExample(ex)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 hover:border-brand-500 bg-white hover:bg-brand-50/20 text-slate-600 dark:text-slate-300 dark:border-darkbg-border dark:bg-darkbg-card/50 dark:hover:bg-darkbg-border/50 hover:text-brand-600 dark:hover:text-brand-400 transition-all active:scale-95"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sandbox Component */}
        <div className="lg:col-span-7">
          <Card className="border-slate-200/70 bg-white shadow-xl p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-darkbg-border/60 pb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Listing Optimization Preview</span>
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-450 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>AI Agent Ready</span>
              </div>
            </div>

            {/* Input fields mock */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Enter Shorthand Title</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={basicInput}
                    onChange={(e) => setBasicInput(e.target.value)}
                    placeholder="e.g. engineering chemistry text..."
                    className="flex-1 rounded-xl border border-slate-200 dark:border-darkbg-border bg-slate-50/50 dark:bg-darkbg-body/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-800 dark:text-white"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleInteractiveOptimize()}
                    isLoading={isOptimizing}
                    disabled={!basicInput.trim()}
                    className="font-bold rounded-xl"
                  >
                    Optimize
                  </Button>
                </div>
              </div>
            </div>

            {/* Output Panel */}
            {optimizationResult && (
              <div className="rounded-2xl border border-brand-100/50 dark:border-brand-950/30 bg-gradient-to-br from-brand-50/30 to-indigo-50/10 dark:from-brand-950/5 dark:to-transparent p-4.5 space-y-4 animate-fade-in">
                
                {/* Header score */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-brand-500" />
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">Gemini Optimization</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-400">Quality Score:</span>
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                      optimizationResult.score >= 95 ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
                    }`}>
                      {optimizationResult.score}/100
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="block font-bold text-slate-450 mb-0.5">Enhanced Title:</span>
                    <p className="font-extrabold text-sm text-slate-850 dark:text-white leading-normal">
                      {optimizationResult.enhanced}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block font-bold text-slate-450 mb-0.5">Suggested Category:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {optimizationResult.category}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="block font-bold text-slate-450 mb-0.5">Generated Rich Description:</span>
                    <p className="text-slate-650 dark:text-slate-450 leading-relaxed font-medium">
                      {optimizationResult.desc}
                    </p>
                  </div>
                </div>

              </div>
            )}

          </Card>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section className="space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-4xl font-extrabold font-display text-slate-900 dark:text-white">
            Three Simple Steps to Swap
          </h2>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-450 max-w-xl mx-auto">
            Our optimized student workflow makes transactions on campus fast and completely stress-free.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          
          {/* Connector lines (Desktop only) */}
          <div className="hidden md:block absolute top-[20%] left-[23%] right-[23%] h-[2px] border-t-2 border-dashed border-slate-200 dark:border-darkbg-border -z-10" />

          {/* Step 1 */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-white dark:bg-darkbg-card border-2 border-brand-500 shadow-md flex items-center justify-center font-black text-lg text-brand-500 font-display">
              1
            </div>
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-slate-900 dark:text-white">Secure Log In</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-[250px]">
                Sign in securely with Google using your official university email to join the safe student circle.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-white dark:bg-darkbg-card border-2 border-slate-200 dark:border-darkbg-border flex items-center justify-center font-black text-lg text-slate-400 dark:text-slate-550 font-display">
              2
            </div>
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-slate-900 dark:text-white">List Your Items</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-[250px]">
                Snap photos, type a basic title, and let our integrated Gemini AI generate a rich description and score listing quality.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-white dark:bg-darkbg-card border-2 border-slate-200 dark:border-darkbg-border flex items-center justify-center font-black text-lg text-slate-400 dark:text-slate-550 font-display">
              3
            </div>
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-slate-900 dark:text-white">Meet Up & Exchange</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-[250px]">
                Chat locally, agree on a price or swap, meet safely at campus landmarks, and confirm transaction keys in-app.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 5. Get Started Callout */}
      <section className="bg-gradient-to-r from-brand-500 to-indigo-600 rounded-3xl p-8 md:p-12 text-center text-white space-y-6 shadow-xl shadow-brand-500/10 relative overflow-hidden">
        
        {/* Abstract shapes inside banner */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-xl pointer-events-none -z-10 translate-x-12 -translate-y-12" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-lg pointer-events-none -z-10 -translate-x-6 translate-y-6" />

        <h2 className="text-2xl md:text-4xl font-extrabold font-display tracking-tight">
          Ready to Declutter Your Dorm?
        </h2>
        <p className="text-sm md:text-base text-brand-100 font-medium max-w-xl mx-auto leading-relaxed">
          Join hundreds of active KPRIET students listing textbooks, notes, and essential gear. Buy what you need, sell what you don't.
        </p>

        <div className="flex items-center justify-center pt-2">
          {session ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/marketplace')}
              className="bg-white hover:bg-slate-100 text-brand-600 font-bold flex items-center gap-2 rounded-xl"
            >
              <span>Go to Marketplace</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/login')}
              className="bg-white hover:bg-slate-100 text-brand-600 font-bold flex items-center gap-2 rounded-xl"
            >
              <span>Get Started Now</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
