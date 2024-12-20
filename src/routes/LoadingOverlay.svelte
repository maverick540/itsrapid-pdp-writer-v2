<script>
  export let visible = false;
</script>

<style>
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    flex-direction: column; /* To stack icon and spinner vertically */
  }

  .spinner-border {
    width: 3rem;
    height: 3rem;
    border: 0.3rem solid #f3f3f3; /* Light grey */
    border-top: 0.3rem solid #3498db; /* Blue */
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>

{#if visible}
<div class="loading-overlay">
    <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
    </div>
</div>
{/if}