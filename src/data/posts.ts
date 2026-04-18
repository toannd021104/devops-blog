import post1 from "@/assets/post-1.jpg";
import post2 from "@/assets/post-2.jpg";
import post3 from "@/assets/post-3.jpg";
import post4 from "@/assets/post-4.jpg";

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  summary: string[];
  takeaways: string[];
  content: string;
};

export const featuredPost: Post = {
  id: "0",
  slug: "kubectl-cheatsheet-daily",
  title: "10 kubectl commands I use every single day",
  excerpt:
    "Not the docs version — just the real ones that save me time in production. Copy-paste ready.",
  category: "Kubernetes",
  date: "Apr 16, 2026",
  readTime: "3 min read",
  image: post2,
  summary: [
    "10 real kubectl commands used in production daily",
    "How to tail logs, exec into pods, and debug crashes",
    "Port-forwarding, rollout status, and resource monitoring",
  ],
  takeaways: [
    "Use kubectl describe to read the Events section — it explains 90% of pod failures",
    "kubectl rollout status blocks until a deploy succeeds or fails — chain it with apply",
    "kubectl top pods requires metrics-server; install it early in every cluster",
  ],
  content: `
I've been working with Kubernetes for a few years now and these are the commands I type almost every single day. No fluff — just the ones that actually matter.

## 1. Get everything in a namespace

\`\`\`bash
kubectl get all -n my-namespace
\`\`\`

One command to see deployments, pods, services, and replicasets. I start here when something breaks.

## 2. Tail logs from a pod

\`\`\`bash
kubectl logs -f pod-name -n my-namespace
\`\`\`

The \`-f\` flag streams live. Add \`--previous\` if the pod already crashed and you need to see why.

## 3. Exec into a running container

\`\`\`bash
kubectl exec -it pod-name -n my-namespace -- /bin/sh
\`\`\`

Use \`/bin/bash\` if the image has it. Invaluable for debugging network issues from inside the pod.

## 4. Describe a broken pod

\`\`\`bash
kubectl describe pod pod-name -n my-namespace
\`\`\`

The **Events** section at the bottom tells you exactly why a pod is stuck in Pending or CrashLoopBackOff.

## 5. Watch pod status in real time

\`\`\`bash
kubectl get pods -n my-namespace -w
\`\`\`

Add \`-w\` to watch. Great during deployments to see pods rolling over.

## 6. Port-forward to a service

\`\`\`bash
kubectl port-forward svc/my-service 8080:80 -n my-namespace
\`\`\`

Test a service locally without exposing it. Faster than setting up an ingress for debugging.

## 7. Apply and watch

\`\`\`bash
kubectl apply -f deployment.yaml && kubectl rollout status deployment/my-app -n my-namespace
\`\`\`

Chain these together. The second command blocks until the rollout completes or fails.

## 8. Force delete a stuck pod

\`\`\`bash
kubectl delete pod pod-name -n my-namespace --grace-period=0 --force
\`\`\`

Only use this when a pod is stuck in Terminating. Don't make it a habit.

## 9. Copy files from a pod

\`\`\`bash
kubectl cp my-namespace/pod-name:/app/logs/error.log ./error.log
\`\`\`

Useful for pulling log files or config dumps out of a running container.

## 10. Check resource usage

\`\`\`bash
kubectl top pods -n my-namespace
\`\`\`

Requires metrics-server installed. Shows CPU and memory at a glance — essential for spotting runaway pods.

---

That's my daily toolkit. Bookmark this, put it in your notes, tattoo it somewhere — whatever works for you.
`,
};

export const posts: Post[] = [];
