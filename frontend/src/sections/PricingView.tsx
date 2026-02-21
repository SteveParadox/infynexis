import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Check, 
  Sparkles, 
  Zap, 
  Crown,
  Building2,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import type { PricingPlan } from '@/types';

interface PricingViewProps {
  currentPlan: 'free' | 'pro' | 'team' | 'enterprise';
}

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    priceUnit: '/month',
    features: [
      'Up to 100 notes',
      'Basic AI search',
      '3 workspaces',
      'Knowledge graph view',
      'Web clipper',
      'Mobile app access',
    ],
    limitations: [
      'No AI insights',
      'No workflows',
      'Limited integrations',
    ],
    cta: 'Get Started',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For power users who want more',
    price: 12,
    priceUnit: '/month',
    features: [
      'Unlimited notes',
      'Advanced AI search',
      'Unlimited workspaces',
      'AI insights & suggestions',
      'Semantic knowledge graph',
      'Voice notes & transcription',
      'Priority support',
    ],
    limitations: [],
    highlighted: true,
    cta: 'Upgrade to Pro',
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For collaborative teams',
    price: 25,
    priceUnit: '/user/month',
    features: [
      'Everything in Pro',
      'Team workspaces',
      'Shared knowledge graphs',
      'Workflow automation',
      'SSO & advanced security',
      'Admin dashboard',
      'API access',
      'Dedicated support',
    ],
    limitations: [],
    cta: 'Start Team Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 0,
    priceUnit: 'Custom',
    features: [
      'Everything in Team',
      'Custom AI models',
      'On-premise deployment',
      'Advanced analytics',
      'SLA guarantee',
      'Custom integrations',
      'Dedicated success manager',
      '24/7 phone support',
    ],
    limitations: [],
    cta: 'Contact Sales',
  },
];

const faqs = [
  {
    question: 'Can I switch plans anytime?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate any differences.',
  },
  {
    question: 'What happens to my data if I cancel?',
    answer: 'Your data remains accessible in read-only mode for 30 days. After that, you can export everything or reactivate your account.',
  },
  {
    question: 'Is there a free trial for paid plans?',
    answer: 'Yes! Pro and Team plans come with a 14-day free trial. No credit card required to start.',
  },
  {
    question: 'How does AI search work?',
    answer: 'Our AI understands natural language queries and finds semantically related content, not just keyword matches. It learns from your usage patterns to improve over time.',
  },
];

export function PricingView({ currentPlan }: PricingViewProps) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const getPlanPrice = (plan: PricingPlan) => {
    if (plan.id === 'enterprise') return 'Custom';
    if (plan.id === 'free') return 'Free';
    const price = isAnnual ? plan.price * 0.8 : plan.price;
    return `$${price}${plan.priceUnit}`;
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Badge className="bg-indigo-500/20 text-indigo-300 mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            Simple Pricing
          </Badge>
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Start free and scale as you grow. All plans include our core knowledge management features.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4">
          <span className={`text-sm ${!isAnnual ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
          <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
          <span className={`text-sm ${isAnnual ? 'text-white' : 'text-slate-500'}`}>
            Annual
            <Badge className="ml-2 bg-emerald-500/20 text-emerald-400">Save 20%</Badge>
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, index) => {
          const isCurrent = currentPlan === plan.id;
          const Icon = plan.id === 'free' ? Zap : plan.id === 'pro' ? Sparkles : plan.id === 'team' ? Crown : Building2;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'relative',
                plan.highlighted && 'lg:-mt-4 lg:mb-4'
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
                    Most Popular
                  </Badge>
                </div>
              )}

              <Card className={cn(
                'h-full bg-slate-900/50 border-white/10',
                plan.highlighted && 'border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-transparent',
                isCurrent && 'border-emerald-500/50'
              )}>
                <CardHeader className="pb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                    plan.id === 'free' && "bg-slate-700 text-slate-300",
                    plan.id === 'pro' && "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
                    plan.id === 'team' && "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
                    plan.id === 'enterprise' && "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                  <p className="text-sm text-slate-400">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div>
                    <span className="text-3xl font-bold text-white">{getPlanPrice(plan)}</span>
                    {plan.price > 0 && plan.id !== 'enterprise' && (
                      <span className="text-slate-500 text-sm">{isAnnual ? '/month, billed annually' : '/month'}</span>
                    )}
                  </div>

                  <Button 
                    className={cn(
                      'w-full',
                      plan.highlighted 
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white'
                        : isCurrent
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-white hover:bg-slate-700'
                    )}
                    disabled={isCurrent}
                  >
                    {isCurrent ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Current Plan
                      </>
                    ) : (
                      <>
                        {plan.cta}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white">Features:</p>
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-300">{feature}</span>
                      </div>
                    ))}
                    {plan.limitations.map((limitation, i) => (
                      <div key={i} className="flex items-start gap-2 opacity-50">
                        <span className="h-4 w-4 rounded-full border border-slate-600 flex-shrink-0" />
                        <span className="text-sm text-slate-500 line-through">{limitation}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Enterprise CTA */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 rounded-2xl p-8 border border-indigo-500/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Need a custom solution?</h2>
            <p className="text-slate-400">
              We offer custom deployments, dedicated infrastructure, and enterprise-grade security.
            </p>
          </div>
          <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
            <Building2 className="h-5 w-5 mr-2" />
            Contact Sales
          </Button>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="bg-slate-900/50 border border-white/10 rounded-lg overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
              >
                <span className="font-medium text-white">{faq.question}</span>
                <HelpCircle className="h-5 w-5 text-slate-500" />
              </button>
              {expandedFaq === index && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  className="px-4 pb-4"
                >
                  <p className="text-slate-400">{faq.answer}</p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trust Badges */}
      <div className="text-center">
        <p className="text-slate-500 text-sm mb-4">Trusted by teams at</p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
          {['Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix'].map((company) => (
            <span key={company} className="text-slate-400 font-semibold">{company}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
