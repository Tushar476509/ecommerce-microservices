import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const FRONTEND_URL = __ENV.FRONTEND_URL || "http://frontend:3000";
const AUTH_URL = __ENV.AUTH_URL || "http://auth-service:3001";
const PRODUCT_URL = __ENV.PRODUCT_URL || "http://product-service:3002";
const ORDER_URL = __ENV.ORDER_URL || "http://order-service:3003";
const DURATION = __ENV.DURATION || "2m";

const checkoutSuccess = new Rate("checkout_success");

export const options = {
  scenarios: {
    browse: {
      executor: "constant-vus",
      exec: "browse",
      vus: Number(__ENV.BROWSE_VUS || 5),
      duration: DURATION,
    },
    checkout: {
      executor: "constant-arrival-rate",
      exec: "checkout",
      startTime: "5s",
      rate: Number(__ENV.CHECKOUTS_PER_MINUTE || 3),
      timeUnit: "1m",
      duration: DURATION,
      preAllocatedVUs: 1,
      maxVUs: 3,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
    checkout_success: ["rate>0.99"],
  },
};

export function setup() {
  const login = http.post(
    `${AUTH_URL}/login`,
    JSON.stringify({ email: "admin@test.com", password: "123456" }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "POST /login" } }
  );
  const products = http.get(`${PRODUCT_URL}/products?limit=1`, { tags: { name: "GET /products" } });

  if (login.status !== 200 || products.status !== 200) {
    throw new Error(`Baseline setup failed: login=${login.status}, products=${products.status}`);
  }

  return {
    token: login.json("accessToken"),
    product: products.json("products.0"),
  };
}

export function browse() {
  const responses = http.batch([
    ["GET", FRONTEND_URL, null, { tags: { name: "GET frontend" } }],
    ["GET", `${PRODUCT_URL}/products?limit=12`, null, { tags: { name: "GET /products" } }],
    ["GET", `${PRODUCT_URL}/categories`, null, { tags: { name: "GET /categories" } }],
  ]);

  check(responses[0], { "frontend is available": (r) => r.status === 200 });
  check(responses[1], { "products are available": (r) => r.status === 200 });
  check(responses[2], { "categories are available": (r) => r.status === 200 });
  sleep(1);
}

export function checkout(data) {
  const payload = JSON.stringify({
    items: [{
      productId: data.product.id,
      name: data.product.name,
      price: data.product.price,
      quantity: 1,
      image: data.product.images?.[0] || "",
    }],
    shippingAddress: {
      street: "1 Baseline Lane",
      city: "Test City",
      state: "KA",
      zip: "560001",
      country: "IN",
    },
    paymentMethod: "local",
  });

  const response = http.post(`${ORDER_URL}/orders`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.token}`,
    },
    tags: { name: "POST /orders" },
  });

  const passed = check(response, { "checkout succeeds": (r) => r.status === 201 });
  checkoutSuccess.add(passed);
}
