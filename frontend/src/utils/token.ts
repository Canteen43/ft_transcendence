

const token = sessionStorage.getItem("token");

const response = await fetch("http://localhost:8080/protected", {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`,
  },
});