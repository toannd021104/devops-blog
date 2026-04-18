import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import avatar from "@/assets/avatar.jpg";

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="container relative py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 h-20 w-20 overflow-hidden rounded-full border-2 border-primary/40 shadow-glow">
            <img
              src={avatar}
              alt="Toan Nguyen"
              width={768}
              height={768}
              className="h-full w-full object-cover"
            />
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Hi, I'm Toan Nguyen 👋
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.1] text-foreground md:text-6xl">
            Hands-on DevOps —{" "}
            <span className="text-primary">học qua thực hành</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            DevOps Engineer. Tôi viết về Kubernetes, Docker, Terraform, CI/CD và bảo mật
            hệ thống — từ lý thuyết đến production thực tế.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="group" asChild>
              <a href="#writing">
                Read the latest
                <ArrowRight className="ml-1 h-4 w-4 transition-smooth group-hover:translate-x-1" />
              </a>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <a href="#about">About me</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
