import Link from 'next/link';
import Image from 'next/image';
import { Twitter, Globe, Github, Send } from 'lucide-react';

const footerLinks = {
  product: [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Agents', href: '/agents' },
    { name: 'Trading', href: '/trading' },
    { name: 'Leaderboard', href: '/leaderboard' },
  ],
  resources: [
    { name: 'Documentation', href: 'https://cuannode.greyscope.xyz/' },
    { name: 'API Reference', href: 'https://portaltestnet.com' },
    { name: 'GitHub', href: 'https://github.com' },
    { name: 'Discord', href: 'https://discord.gg' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Disclaimer', href: '/disclaimer' },
  ],
};

const socialLinks = [
  {
    name: 'Twitter',
    href: 'https://twitter.com/gr3yscope',
    icon: Twitter,
  },
  {
    name: 'Website',
    href: 'https://greyscope.xyz',
    icon: Globe,
  },
  {
    name: 'GitHub',
    href: 'https://github.com/arcxteam',
    icon: Github,
  },
  {
    name: 'Telegram',
    href: 'https://t.me/gr3y0x',
    icon: Send,
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-gradient-to-b from-[#1a1a2e] to-[#16162a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="ANOA"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">ANOA Network</span>
            </Link>
            <p className="mt-4 text-sm text-white/60 max-w-xs">
              The first trustless AI agent platform built on Monad. Deploy
              autonomous trading agents with verifiable onchain execution.
            </p>
            <div className="flex items-center gap-4 mt-6">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/40 hover:text-primary-400 transition-colors"
                    title={link.name}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold text-lg font-bold mb-2 bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">Product</h3>
            <ul className="space-y-1">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/80 hover:text-primary-400 transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold text-lg font-bold mb-2 bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">Resources</h3>
            <ul className="space-y-1">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/80 hover:text-primary-400 transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold text-lg font-bold mb-2 bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">Legal</h3>
            <ul className="space-y-1">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/80 hover:text-primary-400 transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/40">
            &copy; {new Date().getFullYear()} ANOA Network. Greyscope&Co. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-white/40">
            <span>Built on</span>
            <span className="text-primary-400 font-medium">Monad</span>
            <span>for Trustless AI Agent</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
