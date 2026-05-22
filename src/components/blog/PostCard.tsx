import { Link } from "react-router-dom";
import type { Post } from "@/data/posts";

const PostCard = ({ post }: { post: Post }) => {
  return (
    <Link to={`/posts/${post.slug}`}>
    <article className="group cursor-pointer">
      <div className="mb-5 aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted shadow-card">
        <img
          src={post.image}
          alt={post.title}
          width={1024}
          height={768}
          loading="lazy"
          className="h-full w-full object-cover object-center transition-smooth duration-700 group-hover:scale-105 group-hover:opacity-90"
        />
      </div>
      <div className="space-y-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
          {post.category}
        </span>
        <h3 className="font-display text-xl font-semibold leading-tight text-foreground transition-smooth group-hover:text-primary">
          {post.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 font-mono text-[11px] text-muted-foreground">
          <span>{post.date}</span>
          <span aria-hidden>·</span>
          <span>{post.readTime}</span>
        </div>
      </div>
    </article>
    </Link>
  );
};

export default PostCard;
