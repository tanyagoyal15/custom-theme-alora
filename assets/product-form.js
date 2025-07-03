if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');
        this.productInfoElement = document.querySelector('product-info');
        if (!this.productInfoElement) return;

        const selectedVariantRaw = this.productInfoElement.querySelector(
          'variant-selects [data-selected-variant]'
        )?.innerHTML;
        if (!selectedVariantRaw) return;

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      connectedCallback() {
        const productInfoElement = document.querySelector('product-info');
        if (!productInfoElement) return;

        const selectedVariantRaw = productInfoElement.querySelector(
          'variant-selects [data-selected-variant]'
        )?.innerHTML;
        if (!selectedVariantRaw) return;

        const selectedVariant = JSON.parse(selectedVariantRaw);

        const isInWishlist = this.isVariantInWishlist(selectedVariant.id);
        this.updateWishlistIcon(selectedVariant.id, isInWishlist);
      }

      isVariantInWishlist(variantId) {
        const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
        return wishlist.some((item) => item.variant_idd == variantId);
      }

      onSubmitHandler(evt) {
        evt.preventDefault();

        const formType = this.form.dataset.type; // Get data-type (wishlist or cart)
        const formData = new FormData(this.form);

        if (formType === 'add-to-wishlist-form') {
          const variantId = this.form.querySelector('input[name="id"]')?.value;
          const productId = this.form.querySelector('input[name="product-id"]')?.value;

          this.handleWishlistSubmit(formData, variantId, productId);
          return;
        }

        if (formType === 'add-to-cart-form') {
          let productActionsText = this.querySelector('.product-actions-text'); // this line

          if (this.submitButton.getAttribute('aria-disabled') === 'true') return; // bcz of this line when i am clicking variant for second time , it is not reurning from here. check this

          this.handleErrorMessage(); // this line

          this.submitButton.setAttribute('aria-disabled', true); // this line
          this.submitButton.classList.add('loading');
          if (productActionsText) {
            productActionsText.style.visibility = 'hidden';
          }
          this.querySelector('.loading__spinner').classList.remove('hidden');

          const config = fetchConfig('javascript');
          config.headers['X-Requested-With'] = 'XMLHttpRequest';
          delete config.headers['Content-Type'];

          // add-to-cart- form submission /cart/add api call
          if (this.cart) {
            formData.append(
              'sections',
              this.cart.getSectionsToRender().map((section) => section.id)
            );
            formData.append('sections_url', window.location.pathname);
            this.cart.setActiveElement(document.activeElement);
          }
          config.body = formData;

          fetch(`${routes.cart_add_url}`, config)
            .then((response) => response.json())
            .then((response) => {
              if (response.status) {
                publish(PUB_SUB_EVENTS.cartError, {
                  source: 'product-form',
                  productVariantId: formData.get('id'),
                  errors: response.errors || response.description,
                  message: response.message,
                });
                this.handleErrorMessage(response.description);
                if (productActionsText) {
                  this.querySelector('.product-actions-text').style.visibility = 'visible';
                }
                const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
                if (!soldOutMessage) return;
                this.submitButton.setAttribute('aria-disabled', true);
                this.submitButtonText.classList.add('hidden');
                soldOutMessage.classList.remove('hidden');
                this.error = true;
                return;
              } else if (!this.cart) {
                window.location = window.routes.cart_url;
                if (productActionsText) {
                  this.querySelector('.product-actions-text').style.visibility = 'visible';
                }

                return;
              }
              if (productActionsText) {
                this.querySelector('.product-actions-text').style.visibility = 'visible';
              }

              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              });
              this.error = false;
              const quickAddModal = this.closest('quick-add-modal');
              if (quickAddModal) {
                document.body.addEventListener(
                  'modalClosed',
                  () => {
                    setTimeout(() => {
                      this.cart.renderContents(response);
                    });
                  },
                  { once: true }
                );
                quickAddModal.hide(true);
              } else {
                this.cart.renderContents(response);
              }
            })
            .catch((e) => {
              console.error(e);
            })
            .finally(() => {
              this.submitButton.classList.remove('loading');
              if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
              if (!this.error) this.submitButton.removeAttribute('aria-disabled');
              this.querySelector('.loading__spinner').classList.add('hidden');
            });
        }
      }

      handleWishlistSubmit(formData, variantId, productId) {
        const productForm = this.form;
        const container = productForm.closest('.product, .product-card, .product-wrapper');

        const productTitle = container.querySelector('.product__title')?.innerText || '';
        const productImage = container.querySelector('.product__media img')?.getAttribute('src') || '';
        const productPrice = container.querySelector('.price-item--sale')?.innerText || '';
        const productUrl = window.location.href;

        const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

        const existingIndex = wishlist.findIndex((item) => item.variant_idd === variantId);
        const isInWishlist = existingIndex !== -1;

        if (!isInWishlist) {
          wishlist.push({
            variant_idd: variantId,
            product_id: productId,
            title: productTitle,
            image: productImage,
            price: productPrice,
            url: productUrl,
          });
        } else {
          wishlist.splice(existingIndex, 1);
        }

        localStorage.setItem('wishlist', JSON.stringify(wishlist));

        // Update icon based on wishlist status
        this.updateWishlistIcon(variantId, !isInWishlist); // if added now, then it's in wishlist
        this.updateWishlistCount();
      }

      updateWishlistIcon(variantId, isInWishlist) {
        const productForm = document.querySelector('product-form');
        if (!productForm) return;

        const form = productForm.querySelector('form');
        if (!form) return;

        const strokeIcon = form.querySelector('.stroke-icon');
        const fillIcon = form.querySelector('.fill-icon');

        if (isInWishlist) {
          // false - make stroke icon hidden , show
          strokeIcon?.classList.add('hidden');
          fillIcon?.classList.remove('hidden'); // show fill-icon
        } else {
          strokeIcon?.classList.remove('hidden'); // show stroke-icon
          fillIcon?.classList.add('hidden');
        }
      }

      updateWishlistCount() {
        let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
        let wishlistCount = document.querySelector('.wishlist-count');
        if (wishlistCount) {
          if (wishlist.length > 0) {
            wishlistCount.textContent = wishlist.length;
            wishlistCount.style.display = 'flex';
          } else {
            wishlistCount.textContent = '';
            wishlistCount.style.display = 'none';
          }
        }
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          if (this.form.dataset.type === 'add-to-cart-form') {
            this.submitButtonText.textContent = window.variantStrings.addToCart;
          }
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
