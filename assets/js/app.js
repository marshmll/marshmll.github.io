const navItems = document.querySelectorAll('.header__nav-link[href^="#"]');
navItems.forEach(item => item.addEventListener('click', event => {
  event.preventDefault();
  const element = event.target;
  const id = element.getAttribute('href');
  const to = document.querySelector(id).offsetTop;
  window.scroll({
    top: to,
    behavior: 'smooth'
  });
}));

window.addEventListener("load", function () {
  const loader = document.querySelector(".loader");
  loader.className += " hidden";
});