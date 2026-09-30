// Links to a single record. The id goes in the query string, not the path, so every page is static
// and the service worker can save it for offline use. (A /sales/[id] page is built per id on the
// server, so a sale recorded offline could never be opened until the phone was back online.)

const q = (id: string) => encodeURIComponent(id);

export const routes = {
  sale: (id: string) => `/sales/view?id=${q(id)}`,
  editSale: (id: string) => `/sales/edit?id=${q(id)}`,
  newSaleFor: (customerId: string) => `/sales/new?customer=${q(customerId)}`,
  customer: (id: string) => `/customers/view?id=${q(id)}`,
  editCustomer: (id: string) => `/customers/edit?id=${q(id)}`,
  expense: (id: string) => `/expenses/edit?id=${q(id)}`,
};
