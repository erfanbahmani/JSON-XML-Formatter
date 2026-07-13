# JSON & XML Formatter

*A pretty-printer for people who don't trust pretty-printers.*

## What is this

A single-page, zero-dependency, zero-network JSON/XML formatter. Paste your data in, get it formatted, minified, or tree-viewed. No servers, no analytics, no "we value your privacy" popup that immediately violates your privacy.

## Why does this exist

I had some JSON/XML with sensitive data in it and needed to pretty-print it. Every online formatter I found was basically "paste your secrets into our text box, trust us 🙂". Cool, no thanks.

So I asked Claude to build me one that never leaves the browser, and here we are.

## Full disclosure

I am **not** a front-end developer. I don't know what a virtual DOM is and at this point I'm too afraid to ask. Every line of HTML, CSS, and JS in this repo was written by Claude. My contribution was mostly saying "make it cleaner" and "yes" a lot.

If you're a real front-end developer and something in here makes you wince — that's fair, no notes, PRs welcome.

## Features

- Formats JSON and XML (pretty, minified, or as a collapsible tree)
- Syntax highlighting, line numbers, the whole "looks like a real code editor" cosplay
- Copy / download the output
- Drag in a file or paste directly
- Runs 100% locally — open `index.html` and go, no build step, no `npm install` warming up your fans for 10 minutes
- Doesn't send your data anywhere, because it can't — there is no backend, no CDN, no fetch calls, nothing to send it *with*

## How to run it

1. Download this repo
2. Open `index.html` in your browser
3. That's it. That's the whole deployment pipeline.

(You can also unplug your Wi-Fi first if you really want to convince yourself. It'll still work.)

## Security model

"Security through not having a server" — the most robust security model there is. Your data goes: clipboard → textarea → JavaScript variable → back to clipboard/download. It never leaves the tab, never touches a network request, and definitely never gets logged somewhere with a name like `formatter-analytics-prod`.

## Contributing

Sure, go ahead. Just know that the "maintainer" (me) will be reviewing your PR by asking Claude what it does.

## License

MIT. Do whatever you want with it, just don't paste your secrets into a website again.
