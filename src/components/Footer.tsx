interface FooterProps {
  /**
   * Already through resolveTipUrl() on the server. Null means the owner turned
   * the tip link off or the stored URL failed getTipUrl(); either way the tip
   * line stays out of the markup.
   */
  tipUrl: string | null;
}

export default function Footer({ tipUrl }: FooterProps) {
  return (
    <footer className="mt-10 pt-5 border-t border-gray-100 dark:border-gray-800 flex flex-col items-center gap-1.5 text-center">
      {tipUrl && (
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
          CoffeeRadar is independent. If it helped you find something good, you can{" "}
          <a
            href={tipUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-900 dark:text-gray-100 underline underline-offset-2"
          >
            leave a tip ↗
          </a>{" "}
          to cover hosting.
        </p>
      )}
      <p className="text-xs text-gray-300 dark:text-gray-700">CoffeeRadar v1</p>
    </footer>
  );
}
