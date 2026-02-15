'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Zap, Target, TrendingUp, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  const features = [
    {
      icon: Sparkles,
      title: 'Strategic Discovery',
      description: 'Surface high-value audience concepts your clients wouldn\'t think to ask for. Powered by a semantic layer that understands what\'s possible in the data.',
    },
    {
      icon: Target,
      title: 'Precision Execution',
      description: 'From business objective to validated SQL in seconds. Real counts, sample data, instant iteration.',
    },
    {
      icon: Zap,
      title: 'Zero-Touch Fulfillment',
      description: 'Snowflake-native queries, reverse ETL delivery to any destination. No file exports, no manual uploads.',
    },
    {
      icon: TrendingUp,
      title: 'Built to Scale',
      description: 'Serve more clients without adding headcount. The infrastructure handles strategy, translation, and delivery.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Campaign Goals to
              <span className="text-primary"> Activated Audiences in Minutes</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              A platform for agencies and data teams who need to deliver precision audiences at scale.
              Discover strategic segments clients didn't know to ask for, then activate them seamlessly to any destination.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => router.push('/dashboard')}
                className="text-lg px-8 py-6"
              >
                See Platform
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-6">
              Powered by mature infrastructure: Snowflake, reverse ETL, and a proprietary semantic layer that makes it all work.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The platform handles discovery, translation, validation, and delivery. Our team focuses on client relationships.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              See it in action
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Working proof of concept. Strategic discovery through automated delivery.
            </p>
            <Button
              size="lg"
              onClick={() => router.push('/dashboard')}
              className="text-lg px-8 py-6"
            >
              View Platform
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
