import React from 'react';
import { ArrowRight, Shield, Clock, DollarSign, Gift, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

const LandingPage = () => {
  const features = [
    {
      icon: <Clock className="w-10 h-10 text-black" />,
      title: "Real-time Bidding",
      description: "Experience the thrill of live auctions with real-time updates and instant notifications"
    },
    {
      icon: <Shield className="w-10 h-10 text-black" />,
      title: "Secure Transactions",
      description: "Safe and protected bidding with our secure payment system and buyer protection"
    },
    {
      icon: <DollarSign className="w-10 h-10 text-black" />,
      title: "Competitive Pricing",
      description: "Find unique items at great prices through our dynamic bidding system"
    },
    {
      icon: <Gift className="w-10 h-10 text-black" />,
      title: "Unique Finds",
      description: "Discover rare and one-of-a-kind items from sellers worldwide"
    }
  ];

  const categories = [
    "Electronics", "Collectibles", "Art", "Jewelry", "Antiques", "Fashion", "Musical Instruments", "Home & Garden", "Sporting Goods", "Toys & Hobbies", "Health & Beauty", "Pet Supplies", "Automotive Accessories", "Office Equipment"
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-black to-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold mb-6">Welcome to BidBay</h1>
            <p className="text-xl mb-8">Your Premier Online Auction Marketplace</p>
            <div className="flex gap-4 justify-center">
              <Link href={"/login"} >
              <Button size="lg" className="bg-white text-black hover:bg-gray-100">
                Start Bidding
              </Button>
              </Link>
              <Link href={"/login"} >
              <Button size="lg" variant="outline" className="border-white text-black hover:bg-gray-100">
                List an Item
              </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-lg p-6 shadow-lg -mt-20">
            <div className="flex flex-wrap gap-4">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose BidBay?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Start?</h2>
          <p className="text-xl text-gray-600 mb-8">Join thousands of users buying and selling unique items daily</p>
          <Link href={"/login"} >
          <Button size="lg" className="bg-black hover:bg-gray-800">
            Create Account <ArrowRight className="ml-2" />
          </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;