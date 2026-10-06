/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
      fontWeight: {
        // figma:supply-chain (psMOhqaM) — start
        "figma-light": "300",
        "figma-normal": "400",
        "figma-medium": "500",
        // figma:supply-chain (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-light": "300",
        "figma-normal": "400",
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-light": "300",
        "figma-normal": "400",
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-light": "300",
        "figma-normal": "400",
        // figma:untitled (psMOhqaM) — end
      },
      lineHeight: {
        // figma:supply-chain (psMOhqaM) — start
        "figma-13": "13px",
        "figma-16": "16px",
        "figma-18": "18px",
        "figma-31": "31px",
        "figma-48": "48px",
        // figma:supply-chain (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-13": "13px",
        "figma-16": "16px",
        "figma-18": "18px",
        "figma-48": "48px",
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-13": "13px",
        "figma-16": "16px",
        "figma-18": "18px",
        "figma-48": "48px",
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-13": "13px",
        "figma-16": "16px",
        "figma-18": "18px",
        "figma-48": "48px",
        // figma:untitled (psMOhqaM) — end
      },
      fontSize: {
        // figma:supply-chain (psMOhqaM) — start
        "figma-10": "10px",
        "figma-12": "12px",
        "figma-14": "14px",
        "figma-24": "24px",
        "figma-48": "48px",
        // figma:supply-chain (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-10": "10px",
        "figma-12": "12px",
        "figma-14": "14px",
        "figma-48": "48px",
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-10": "10px",
        "figma-12": "12px",
        "figma-14": "14px",
        "figma-48": "48px",
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-10": "10px",
        "figma-12": "12px",
        "figma-14": "14px",
        "figma-48": "48px",
        // figma:untitled (psMOhqaM) — end
      },
  		fontFamily: {
        // figma:untitled (psMOhqaM) — start
        "paragraph": ['"Inter"', 'sans-serif'],
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "heading": ['"Hanken Grotesk"', 'sans-serif'],
        // figma:untitled (psMOhqaM) — end
      
  			inter: ['var(--font-inter)'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
        // figma:supply-chain (psMOhqaM) — start
        "figma-primary-3": "hsl(var(--figma-primary-3))",
        "figma-secondary-4": "hsl(var(--figma-secondary-4))",
        "figma-accent-2": "hsl(var(--figma-accent-2))",
        "figma-muted-3": "hsl(var(--figma-muted-3))",
        "figma-border-3": "hsl(var(--figma-border-3))",
        "figma-color-12-2": "hsl(var(--figma-color-12-2))",
        // figma:supply-chain (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-primary-2": "hsl(var(--figma-primary-2))",
        "figma-secondary-3": "hsl(var(--figma-secondary-3))",
        "figma-muted-2": "hsl(var(--figma-muted-2))",
        "figma-border-2": "hsl(var(--figma-border-2))",
        "figma-color-11-2": "hsl(var(--figma-color-11-2))",
        "figma-color-14-2": "hsl(var(--figma-color-14-2))",
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-secondary-2": "hsl(var(--figma-secondary-2))",
        "figma-color-10-2": "hsl(var(--figma-color-10-2))",
        // figma:untitled (psMOhqaM) — end
      
        // figma:untitled (psMOhqaM) — start
        "figma-primary": "hsl(var(--figma-primary))",
        "figma-secondary": "hsl(var(--figma-secondary))",
        "figma-accent": "hsl(var(--figma-accent))",
        "figma-muted": "hsl(var(--figma-muted))",
        "figma-surface": "hsl(var(--figma-surface))",
        "figma-border": "hsl(var(--figma-border))",
        "figma-highlight": "hsl(var(--figma-highlight))",
        "figma-subtle": "hsl(var(--figma-subtle))",
        "figma-color-9": "hsl(var(--figma-color-9))",
        "figma-color-10": "hsl(var(--figma-color-10))",
        "figma-color-11": "hsl(var(--figma-color-11))",
        "figma-color-12": "hsl(var(--figma-color-12))",
        "figma-color-13": "hsl(var(--figma-color-13))",
        "figma-color-14": "hsl(var(--figma-color-14))",
        "figma-color-15": "hsl(var(--figma-color-15))",
        "figma-color-16": "hsl(var(--figma-color-16))",
        "figma-text-1": "hsl(var(--figma-text-1))",
        "figma-text-2": "hsl(var(--figma-text-2))",
        // figma:untitled (psMOhqaM) — end
      
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}