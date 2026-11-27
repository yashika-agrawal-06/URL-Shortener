# HPA & Load Testing Guide (`url-shortener-lab`)

## 1. Apply and Verify HPA

Once the `t3a.medium` worker node is scaled back up from `0` to `1` and pods are `Running`:

```powershell
# Connect kubectl (if not already configured)
aws eks update-kubeconfig --name url-shortener-lab --region ap-south-1

# Apply HPA
kubectl apply -f k8s/hpa.yaml

# Confirm HPA and Metrics Server CPU readings (wait ~30-60s for initial metrics)
kubectl get hpa -n url-shortener
kubectl describe hpa url-shortener-hpa -n url-shortener
kubectl top pods -n url-shortener
```

Expected initial state: `TARGETS` shows `<percent>%/70%`, `MINPODS: 1`, `MAXPODS: 2`, `REPLICAS: 1`.

## 2. Watch HPA and Pods During the Load Test

Open two extra terminals while testing:

```powershell
# Terminal 1: watch HPA metrics and replica count
kubectl get hpa url-shortener-hpa -n url-shortener -w

# Terminal 2: watch pods scaling from 1 -> 2 and back to 1
kubectl get pods -n url-shortener -w
```

## 3. Run the Load Test

### Option A: Through Nginx Port-Forward (quickest)

```powershell
# Terminal 3: keep port-forward running
kubectl port-forward svc/url-shortener-nginx 8080:80 -n url-shortener

# Terminal 4: run gradual concurrency ramp-up
$env:TARGET_URL="http://localhost:8080"
$env:MODE="mixed"
$env:STAGES="5:15,15:20,30:30,50:30"
node load-test/load-test.mjs
```

### Option B: In-Cluster Pod (avoids `kubectl port-forward` bottleneck)

Targets the `url-shortener` Service (`port 3000`) or `url-shortener-nginx` (`port 80`) directly inside the `url-shortener` namespace:

```powershell
kubectl create configmap load-test-script --from-file=load-test.mjs=load-test/load-test.mjs -n url-shortener

kubectl run load-generator --rm -it --restart=Never `
  --image=node:26-alpine -n url-shortener `
  --env="TARGET_URL=http://url-shortener:3000" `
  --env="MODE=mixed" `
  --env="STAGES=5:15,15:20,30:30,50:30" `
  --overrides='{"spec":{"containers":[{"name":"load-generator","image":"node:26-alpine","command":["node","/scripts/load-test.mjs"],"volumeMounts":[{"name":"script","mountPath":"/scripts"}]}],"volumes":[{"name":"script","configMap":{"name":"load-test-script"}}]}}'

# Clean up ConfigMap after testing
kubectl delete configmap load-test-script -n url-shortener
```

> **Note on `express-rate-limit` (`429 Too Many Requests`):**
> [src/middleware/rateLimiter.js](../src/middleware/rateLimiter.js) limits `/api/*` to **100 requests per minute per IP**.
> Because `kubectl port-forward` and Nginx send all load-test traffic from a single source IP, requests beyond 100/min will receive HTTP `429`, which stops requests before hitting Redis/CPU and can prevent pods from reaching 70% CPU.
> - To measure pure `/api/` scaling under sustained CPU load, temporarily raise or make `max` configurable via an env var before building a test image, **or**
> - Run `MODE=health` against `http://url-shortener:3000` (`/health` is mounted before the rate limiter in [src/app.js](../src/app.js)) to verify HPA CPU scale-up without hitting `429`.

## 4. Verify Scale-Down

After the script finishes:
1. Keep `kubectl get hpa url-shortener-hpa -n url-shortener -w` running.
2. With `behavior.scaleDown.stabilizationWindowSeconds: 60`, replicas should scale back from `2` to `1` roughly 1–2 minutes after CPU drops below 70%.

## 5. Results Template (Share with Team)

| Metric | Value |
| --- | --- |
| Target Endpoint (`url-shortener` / `url-shortener-nginx`) | |
| Mode & Stages (`STAGES`) | |
| Overall Requests per Second (RPS) | |
| Average Response Time (ms) | |
| Error Rate (%) | |
| Peak CPU Utilization (%) | |
| Maximum Replicas Reached (`1` -> `2`) | |
| Scale-Up & Scale-Down Observed? | |
