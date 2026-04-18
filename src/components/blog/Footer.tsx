const Footer = () => {
  return (
    <footer className="border-t border-border">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 text-sm text-muted-foreground md:flex-row">
        <p className="font-display text-base text-foreground">Toan Nguyen<span className="text-primary">.</span>devops</p>
        <p className="font-mono text-xs">© {new Date().getFullYear()} — built with too much coffee.</p>
        <div className="flex gap-6 font-mono text-xs">
          <a href="https://github.com/toannd021104" className="transition-smooth hover:text-primary">github</a>
          <a href="#" className="transition-smooth hover:text-primary">rss</a>
          <a href="#" className="transition-smooth hover:text-primary">linkedin</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
