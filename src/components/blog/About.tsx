import avatar from "@/assets/avatar.jpg";

const stack = [
  { name: "Kubernetes", color: "bg-blue-500" },
  { name: "Terraform", color: "bg-green-500" },
  { name: "Argo CD", color: "bg-yellow-500" },
  { name: "Grafana", color: "bg-purple-500" },
  { name: "Docker", color: "bg-cyan-500" },
  { name: "Prometheus", color: "bg-orange-500" },
  { name: "GitLab CI", color: "bg-red-500" },
  { name: "AWS", color: "bg-yellow-400" },
];


const About = () => {
  return (
    <section id="about" className="border-y border-border bg-secondary/30">
      <div className="container grid gap-10 py-20 md:grid-cols-[auto_1fr_320px] md:items-start md:gap-14">
        {/* Avatar */}
        <div className="mx-auto h-40 w-40 overflow-hidden rounded-2xl border border-border shadow-card md:mx-0">
          <img
            src={avatar}
            alt="Toan Nguyen"
            width={768}
            height={768}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Bio */}
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            // about
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-foreground md:text-4xl">
            DevOps Engineer. Học bằng cách làm thật.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Tôi là Toan Nguyen — DevOps Engineer đam mê xây dựng hệ thống cloud-native. Blog này
            là nơi tôi chia sẻ hands-on labs về Kubernetes, Terraform, Docker, CI/CD và
            security — viết cho người Việt học DevOps thực chiến.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 font-mono text-sm">
            <a href="https://github.com/toannd021104" target="_blank" rel="noopener noreferrer" className="text-primary transition-smooth hover:underline">
              github →
            </a>
            <a href="https://www.linkedin.com/in/toanndcloud/" target="_blank" rel="noopener noreferrer" className="text-primary transition-smooth hover:underline">
              linkedin →
            </a>
            <a href="mailto:toanndcloud@gmail.com" className="text-primary transition-smooth hover:underline">
              email →
            </a>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5">
{/* My Stack */}
          <div className="rounded-xl border border-border bg-background p-5 shadow-card">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">My Stack</span>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {stack.map((tech) => (
                <div key={tech.name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${tech.color}`} />
                  <span className="text-xs font-medium text-foreground">{tech.name}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default About;
