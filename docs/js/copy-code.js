document.addEventListener('DOMContentLoaded', function() {
    // Находим все блоки кода
    document.querySelectorAll('pre').forEach(function(pre) {
        // Создаём кнопку
        var button = document.createElement('button');
        button.className = 'copy-button';
        button.textContent = 'Copy';

        // Обработчик клика
        button.addEventListener('click', function() {
            var code = pre.querySelector('code');
            var text = code ? code.textContent : pre.textContent;

            navigator.clipboard.writeText(text).then(function() {
                button.textContent = 'Copied!';
                setTimeout(function() {
                    button.textContent = 'Copy';
                }, 2000);
            });
        });

        // Добавляем кнопку в блок
        pre.style.position = 'relative';
        pre.appendChild(button);
    });
});
