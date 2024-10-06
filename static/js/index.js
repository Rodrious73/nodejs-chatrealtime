document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
  
    if (error === 'user_exists') {
        const infoMessage = document.getElementById('infoMessage');
        infoMessage.style.display = 'flex';
    }

    const closeButton = document.querySelector('.info__close');
    closeButton.addEventListener('click', () => {
        document.getElementById('infoMessage').style.display = 'none'; 
    });
});