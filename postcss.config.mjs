/**
 * Ensures every declaration block that uses `-webkit-line-clamp` also declares
 * the standard `line-clamp` property (satisfies stylelint / IDE compatibility
 * warnings). Tailwind v4 can emit multiple `.line-clamp-*` rules; only the
 * custom `@utility` in main.css had both properties before this pass.
 */
function addStandardLineClamp() {
  return {
    postcssPlugin: "add-standard-line-clamp",
    OnceExit(root) {
      root.walkRules((rule) => {
        let webkitDecl = null;
        let hasLineClamp = false;
        rule.walkDecls((decl) => {
          if (decl.prop === "-webkit-line-clamp") {
            webkitDecl = decl;
          }
          if (decl.prop === "line-clamp") {
            hasLineClamp = true;
          }
        });
        if (webkitDecl && !hasLineClamp) {
          webkitDecl.cloneAfter({
            prop: "line-clamp",
            value: webkitDecl.value,
          });
        }
      });
    },
  };
}

addStandardLineClamp.postcss = true;

export default {
  plugins: [addStandardLineClamp()],
};
